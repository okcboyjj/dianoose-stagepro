import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

function withId(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

// Firestore's persistent-cache client routes plain getDoc/getDocs reads through its underlying
// watch stream, which is flaky in Capacitor's WKWebView — it's dropped connections with
// "unavailable"/"network connection was lost", and separately returned an empty *cached* result
// set for a query that had never been cached (a real doc, silently reported as not found) rather
// than waiting on the network. Using the *FromServer variants forces a real one-shot server round
// trip instead of going through that cache/watch layer, which sidesteps both failure modes.
// Still retry once on top of that for genuine transient network errors.
async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    const transient = e?.code === "unavailable" || /network/i.test(e?.message || "");
    if (!transient) throw e;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return fn();
  }
}

function applySort(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    if (av === bv) return 0;
    const cmp = av > bv ? 1 : -1;
    return desc ? -cmp : cmp;
  });
}

function buildWhereConstraints(filterObj) {
  return Object.entries(filterObj).map(([field, value]) => {
    if (value && typeof value === "object" && Array.isArray(value.in)) {
      return where(field, "in", value.in);
    }
    return where(field, "==", value);
  });
}

// Mirrors the shape of the Base44 entity SDK (list/filter/create/update/delete/subscribe)
// so the ~20 components already written against it don't need to change.
// Sorting/limiting happens client-side after an equality-only Firestore query, which sidesteps
// Firestore's composite-index requirement — fine at single-church scale (low hundreds of docs/collection).
export function createEntity(collectionName, { idField } = {}) {
  const colRef = collection(db, collectionName);

  async function filter(filterObj = {}, sort, limitN) {
    // A query filtered by the doc's own ID (or the entity's idField, e.g. ChurchMember's
    // user_id) becomes a direct getDoc — Firestore's security rules can't verify a `list`
    // query against a rule keyed on document ID when the query filters by a different field.
    const directIdValue = filterObj.id ?? (idField && filterObj[idField]);
    if (directIdValue) {
      const snap = await withRetry(() => getDocFromServer(doc(db, collectionName, directIdValue)));
      if (!snap.exists()) return [];
      const row = withId(snap);
      const rest = { ...filterObj };
      delete rest.id;
      if (idField) delete rest[idField];
      const matches = Object.entries(rest).every(([k, v]) => row[k] === v);
      return matches ? [row] : [];
    }

    const constraints = buildWhereConstraints(filterObj);
    const q = constraints.length ? query(colRef, ...constraints) : colRef;
    const snap = await withRetry(() => getDocsFromServer(q));
    let rows = snap.docs.map(withId);
    rows = applySort(rows, sort);
    if (limitN) rows = rows.slice(0, limitN);
    return rows;
  }

  async function list(sort, limitN) {
    return filter({}, sort, limitN);
  }

  async function create(data) {
    const now = new Date().toISOString();
    const payload = { ...data, created_date: data.created_date || now, updated_date: now };
    if (idField && data[idField]) {
      const id = data[idField];
      await setDoc(doc(db, collectionName, id), payload);
      return { id, ...payload };
    }
    const ref = await addDoc(colRef, payload);
    return { id: ref.id, ...payload };
  }

  async function update(id, data) {
    const payload = { ...data, updated_date: new Date().toISOString() };
    await updateDoc(doc(db, collectionName, id), payload);
    return { id, ...payload };
  }

  async function del(id) {
    await deleteDoc(doc(db, collectionName, id));
    return { id };
  }

  // filterObj supports { field: { in: [...] } } for Firestore's 'in' operator (used to scope
  // realtime listeners, since Firestore requires listen queries to have a matching where clause).
  function subscribe(filterObj, callback) {
    const constraints = buildWhereConstraints(filterObj || {});
    const q = constraints.length ? query(colRef, ...constraints) : colRef;
    return onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        const data = withId(change.doc);
        const type = change.type === "added" ? "create" : change.type === "modified" ? "update" : "delete";
        callback({ type, id: change.doc.id, data });
      });
    });
  }

  return { list, filter, create, update, delete: del, subscribe };
}
