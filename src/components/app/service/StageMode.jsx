import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Type, Settings, Play, Pause, Radio, Drum } from "lucide-react";
import { transposeFullChart, ALL_KEYS, suggestCapo } from "../song/ChordTransposer";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/firebase";
import { Metronome } from "@/lib/metronome";

// ── Chart line classification (kept in sync with ChartViewer) ───────────────────────────
const CHORD_TOKEN = /^[A-G][b#]?(?:maj7|maj|min7|m7|m|sus4|sus2|sus|add9|add2|dim7|dim|aug|7|9|11|13)?(?:\/[A-G][b#]?)?$/;
const CHORD_REGEX = /(?<![A-Za-z#b])([A-G][b#]?(?:maj7|maj|min7|m7|m|sus4|sus2|sus|add9|add2|dim7|dim|aug|7|9|11)?(?:\/[A-G][b#]?)?)(?![A-Za-z#])/g;

function isChordLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("[")) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  const chords = tokens.filter(x => CHORD_TOKEN.test(x)).length;
  return chords > 0 && chords >= tokens.length * 0.5 && !/[,!?]/.test(t);
}
function isSectionHeader(line) {
  const t = line.trim();
  if (t.startsWith("[")) return true;
  return /^(verse|chorus|bridge|pre.?chorus|intro|outro|tag|interlude|hook|vamp|instrumental|refrain)\s*\d*$/i.test(t);
}

// A chord line with the chords highlighted, sized for the stage.
function ChordLine({ line, fontSize }) {
  const parts = [];
  let last = 0, m;
  const re = new RegExp(CHORD_REGEX.source, "g");
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push({ t: "x", v: line.slice(last, m.index) });
    parts.push({ t: "c", v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ t: "x", v: line.slice(last) });
  return (
    <div style={{ fontSize, fontFamily: "monospace", whiteSpace: "pre", lineHeight: 1.5 }}>
      {parts.map((p, i) =>
        p.t === "c"
          ? <span key={i} className="text-[#8B80FF] font-bold">{p.v}</span>
          : <span key={i} className="text-white/90">{p.v}</span>
      )}
    </div>
  );
}

const NEXT_DEFAULT = ["ArrowRight", "ArrowDown", "PageDown", "Space"];
const PREV_DEFAULT = ["ArrowLeft", "ArrowUp", "PageUp"];

export default function StageMode({ service, songs, currentUser, onClose, onSaveArrangement }) {
  // Resolve the setlist in order. Memoized so downstream callbacks (writeSession, the sync
  // heartbeat) keep a stable identity across the 15s staleness re-renders.
  const setlist = useMemo(
    () => (service?.songs || []).map(id => songs.find(s => s.id === id)).filter(Boolean),
    [service?.songs, songs]
  );

  // Per-service arrangement (key/tempo/notes decided at practice), keyed by song id.
  const arrangements = service?.arrangements || {};

  const [index, setIndex] = useState(0);
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem("stage_font")) || 26);
  // Seed transpose from the saved arrangement so Sunday opens in the rehearsed key.
  const [semitonesById, setSemitonesById] = useState(() => {
    const init = {};
    Object.keys(arrangements).forEach(id => {
      if (typeof arrangements[id]?.semitones === "number") init[id] = arrangements[id].semitones;
    });
    return init;
  });
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [learning, setLearning] = useState(null); // 'next' | 'prev' | null

  // Footswitch key mappings (persisted). Most page-turner pedals send configurable keystrokes.
  const [nextKeys, setNextKeys] = useState(() => JSON.parse(localStorage.getItem("stage_next") || "null") || NEXT_DEFAULT);
  const [prevKeys, setPrevKeys] = useState(() => JSON.parse(localStorage.getItem("stage_prev") || "null") || PREV_DEFAULT);
  // Drafts for the current song's editable arrangement (saved on blur).
  const [noteDraft, setNoteDraft] = useState("");
  const [bpmDraft, setBpmDraft] = useState("");

  const scrollRef = useRef(null);
  const hideTimer = useRef(null);
  const wakeLock = useRef(null);

  const song = setlist[index];
  const arr = arrangements[song?.id] || {};
  const originalKey = song?.key || "G";
  const semis = semitonesById[song?.id] || 0;
  const currentKey = ALL_KEYS[(ALL_KEYS.indexOf(originalKey) + semis + 120) % 12] || originalKey;
  const capo = suggestCapo(originalKey, currentKey);
  const chart = transposeFullChart(song?.chart_content || "", semis, currentKey);
  const bpm = arr.bpm || song?.bpm;          // service arrangement can override the song's default
  const notes = arr.notes;                    // free-text arrangement notes for the team

  const next = useCallback(() => setIndex(i => Math.min(i + 1, setlist.length - 1)), [setlist.length]);
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);
  const transpose = (dir) => setSemitonesById(m => {
    const v = ((m[song.id] || 0) + dir + 12) % 12;
    onSaveArrangement?.(song.id, { semitones: v });   // persist the rehearsed key to the service
    return { ...m, [song.id]: v };
  });

  // ── Sunday Sync ───────────────────────────────────────────────────────────────────────
  // One person taps "Go Live" and becomes the leader; a `liveSession` object is written onto
  // the service doc. Everyone else with Stage Mode open subscribes and their screen follows
  // the leader's current song. A heartbeat keeps the session fresh so a closed-tab leader's
  // session auto-expires (staleness) instead of stranding followers.
  const STALE_MS = 90000;
  const myId = currentUser?.id;
  const myName = currentUser?.first_name || (currentUser?.full_name || "").split(" ")[0] || "Leader";
  const [liveSession, setLiveSession] = useState(() => service?.liveSession || null);
  const [leftSync, setLeftSync] = useState(false);        // follower opted out locally
  const [nowTick, setNowTick] = useState(() => Date.now()); // re-evaluates staleness over time
  const firstBroadcast = useRef(true);

  const leaderName = liveSession?.leaderName || "Leader";
  const sessionFresh = !!liveSession?.active && (nowTick - (liveSession.at || 0) < STALE_MS);
  const isLeader = sessionFresh && liveSession.leaderId === myId;
  const someoneElseLive = sessionFresh && liveSession.leaderId !== myId;
  const following = someoneElseLive && !leftSync;
  const followingRef = useRef(following);
  useEffect(() => { followingRef.current = following; }, [following]);

  const currentSection = useRef(0); // leader's current section index within the song

  // Broadcast the leader's current position (song + section; also used as the heartbeat).
  const writeSession = useCallback((extra) => {
    if (!myId || !service?.id) return;
    const s = {
      active: true, leaderId: myId, leaderName: myName,
      songId: setlist[index]?.id || null,
      sectionIndex: Math.max(0, currentSection.current),
      at: Date.now(), ...extra,
    };
    setLiveSession(s);
    base44.entities.Service.update(service.id, { liveSession: s }).catch(() => {});
  }, [myId, myName, service?.id, setlist, index]);

  const goLive = () => { firstBroadcast.current = false; currentSection.current = 0; writeSession({ sectionIndex: 0 }); track("stage_sync_started", { songs: setlist.length }); };
  const endLive = () => {
    if (!service?.id) return;
    const s = { active: false, leaderId: myId, leaderName: "", songId: null, at: Date.now() };
    setLiveSession(s);
    base44.entities.Service.update(service.id, { liveSession: s }).catch(() => {});
  };

  // Subscribe to this service's live-session state (scoped by church, filtered to our id).
  useEffect(() => {
    if (!service?.church_id || !service?.id) return;
    const unsub = base44.entities.Service.subscribe({ church_id: service.church_id }, (c) => {
      if (c.id !== service.id || c.type === "delete") return;
      setLiveSession(c.data?.liveSession || null);
    });
    return () => unsub();
  }, [service?.id, service?.church_id]);

  // Keep staleness fresh even when no updates arrive.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // A brand-new session (new leader, or re-activated) clears any prior local opt-out so
  // followers auto-join. Heartbeats (which only change `at`) don't retrigger this.
  useEffect(() => {
    if (liveSession?.active) setLeftSync(false);
  }, [liveSession?.leaderId, liveSession?.active]);

  // Follower: mirror the leader's current song.
  useEffect(() => {
    if (!following) return;
    const i = setlist.findIndex(s => s.id === liveSession?.songId);
    if (i >= 0) setIndex(i);
  }, [following, liveSession?.songId]);

  // Leader: broadcast on song change (skip the mount fire) + heartbeat while live.
  useEffect(() => {
    if (!isLeader) return;
    if (firstBroadcast.current) { firstBroadcast.current = false; return; }
    currentSection.current = 0;               // new song starts at its first section
    writeSession({ sectionIndex: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    if (!isLeader) return;
    const id = setInterval(() => writeSession(), 25000);
    return () => clearInterval(id);
  }, [isLeader, writeSession]);

  // Manual navigation while following = take local control (leave sync).
  const gotoIndex = (i) => {
    if (following) setLeftSync(true);
    setIndex(Math.max(0, Math.min(setlist.length - 1, i)));
  };
  const userNext = () => gotoIndex(index + 1);
  const userPrev = () => gotoIndex(index - 1);

  // ── Section-level sync ──────────────────────────────────────────────────────────────────
  // Section headers register their DOM nodes here (by section index) as the chart renders.
  // The leader broadcasts whichever section is scrolled to the top; followers scroll to match.
  // Anchoring on section headers (not pixels) keeps it correct across font sizes / screen sizes.
  const sectionEls = useRef([]);
  const scrollRaf = useRef(0);

  const onChartScroll = () => {
    if (!isLeader) return;                 // only the leader broadcasts section position
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const cont = scrollRef.current;
      if (!cont) return;
      const contTop = cont.getBoundingClientRect().top;
      let si = 0;
      for (let i = 0; i < sectionEls.current.length; i++) {
        const el = sectionEls.current[i];
        if (el && el.getBoundingClientRect().top - contTop <= 8) si = i; else break;
      }
      if (si !== currentSection.current) {
        currentSection.current = si;
        writeSession({ sectionIndex: si });   // fires only when crossing a section boundary
      }
    });
  };

  // Follower: scroll the leader's current section header to the top.
  useEffect(() => {
    if (!following) return;
    const si = liveSession?.sectionIndex;
    if (typeof si !== "number") return;
    const el = sectionEls.current[si];
    const cont = scrollRef.current;
    if (el && cont) {
      const offset = el.getBoundingClientRect().top - cont.getBoundingClientRect().top;
      cont.scrollTop += offset - 12;
    }
  }, [following, liveSession?.sectionIndex, liveSession?.songId, index]);

  // ── Click track (local metronome, per device) ──────────────────────────────────────────
  const metroRef = useRef(null);
  const [clickOn, setClickOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const clickBpm = bpm || 90;

  useEffect(() => {
    metroRef.current = new Metronome((b) => setBeat(b));
    return () => { metroRef.current?.dispose(); metroRef.current = null; };
  }, []);
  const toggleClick = () => {
    const m = metroRef.current;
    if (!m) return;
    if (clickOn) { m.stop(); setClickOn(false); setBeat(-1); }
    else { m.start(clickBpm, 4); setClickOn(true); track("stage_click_started", { bpm: clickBpm }); }
  };
  // Follow tempo edits live without restarting the click…
  useEffect(() => { if (clickOn) metroRef.current?.setBpm(clickBpm); }, [clickBpm, clickOn]);
  // …but restart the bar count on song change so the accent lands on the new downbeat.
  useEffect(() => {
    if (clickOn) metroRef.current?.start(clickBpm, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Reset scroll + reseed arrangement drafts when the song changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const a = arrangements[setlist[index]?.id] || {};
    setNoteDraft(a.notes || "");
    setBpmDraft(a.bpm || "");
  }, [index]);

  // Keep the screen awake during the service (where supported).
  useEffect(() => {
    let released = false;
    const acquire = async () => {
      try { if ("wakeLock" in navigator) wakeLock.current = await navigator.wakeLock.request("screen"); } catch { /* unsupported */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible" && !released) acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { released = true; document.removeEventListener("visibilitychange", onVis); try { wakeLock.current?.release(); } catch { /* noop */ } };
  }, []);

  // Keyboard / footswitch handling (+ learn mode).
  useEffect(() => {
    const onKey = (e) => {
      const code = e.code || e.key;
      if (learning) {
        e.preventDefault();
        const setter = learning === "next" ? setNextKeys : setPrevKeys;
        const storeKey = learning === "next" ? "stage_next" : "stage_prev";
        setter(keys => {
          const updated = keys.includes(code) ? keys : [...keys, code];
          localStorage.setItem(storeKey, JSON.stringify(updated));
          return updated;
        });
        setLearning(null);
        return;
      }
      if (nextKeys.includes(code)) { e.preventDefault(); if (followingRef.current) setLeftSync(true); next(); flashControls(); }
      else if (prevKeys.includes(code)) { e.preventDefault(); if (followingRef.current) setLeftSync(true); prev(); flashControls(); }
      else if (code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learning, nextKeys, prevKeys, next, prev, onClose]);

  // Auto-scroll for long charts.
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = setInterval(() => { el.scrollTop += 1; }, 60);
    return () => clearInterval(id);
  }, [autoScroll, index]);

  // Auto-hide the controls for a clean stage view.
  const flashControls = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  };
  useEffect(() => { flashControls(); return () => clearTimeout(hideTimer.current); }, []);

  // Swipe navigation.
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 70) (dx < 0 ? userNext() : userPrev());
    touchStart.current = null;
  };

  const changeFont = (d) => setFontSize(f => { const v = Math.max(16, Math.min(56, f + d)); localStorage.setItem("stage_font", v); return v; });

  const renderChart = () => {
    if (!chart) return <p className="text-white/40 text-xl italic">No chart for this song.</p>;
    sectionEls.current.length = 0; // rebuilt each render; section headers re-register below
    let si = -1;
    return chart.split("\n").map((line, i) => {
      if (isSectionHeader(line)) {
        si += 1;
        const myIdx = si;
        return <p key={i} ref={el => { if (el) sectionEls.current[myIdx] = el; }} className="text-[#8B80FF] font-extrabold uppercase tracking-wide mt-6 mb-1" style={{ fontSize: fontSize * 0.8 }}>{line.replace(/[[\]]/g, "")}</p>;
      }
      if (line.trim() === "") return <div key={i} style={{ height: fontSize * 0.6 }} />;
      if (isChordLine(line)) return <ChordLine key={i} line={line} fontSize={fontSize} />;
      return <div key={i} style={{ fontSize, fontFamily: "monospace", whiteSpace: "pre", lineHeight: 1.5 }} className="text-white/70">{line}</div>;
    });
  };

  if (!setlist.length) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-4 text-white/70">
        <p>No songs in this service's setlist yet.</p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10">Close</button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black text-white flex flex-col select-none"
      onMouseMove={flashControls}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"><X className="w-5 h-5" /></button>
        <div className="min-w-0">
          <div className="font-bold text-lg truncate">{song?.title}</div>
          <div className="text-xs text-white/50">{song?.artist}</div>
        </div>
        <div className="flex-1" />
        {/* Sunday Sync — lead everyone's screens, or follow the leader */}
        {myId && (
          isLeader ? (
            <button onClick={endLive} title="You're leading — tap to end" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-red-500/90 hover:bg-red-500 text-white">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
            </button>
          ) : following ? (
            <button onClick={() => setLeftSync(true)} title={`Following ${leaderName} — tap to browse on your own`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30">
              <Radio className="w-3.5 h-3.5" /> Following {leaderName}
            </button>
          ) : someoneElseLive ? (
            <button onClick={() => setLeftSync(false)} title={`${leaderName} is leading — tap to follow`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30">
              <Radio className="w-3.5 h-3.5" /> Rejoin {leaderName}
            </button>
          ) : (
            <button onClick={goLive} title="Lead everyone's screens" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white/80">
              <Radio className="w-3.5 h-3.5" /> Go Live
            </button>
          )
        )}
        {/* Key + capo + transpose */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
          <button onClick={() => transpose(-1)} className="w-7 h-7 rounded font-bold hover:bg-white/10">−</button>
          <span className="px-1 font-mono text-sm text-[#8B80FF] font-bold min-w-[34px] text-center">{currentKey}</span>
          <button onClick={() => transpose(1)} className="w-7 h-7 rounded font-bold hover:bg-white/10">+</button>
        </div>
        {capo > 0 && <span className="text-xs font-mono bg-[#6C63FF]/20 text-[#8B80FF] px-2 py-1 rounded-lg">CAPO {capo}</span>}
        {bpm && <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded-lg">{bpm} BPM</span>}
        {/* Click track (local metronome) */}
        <button onClick={toggleClick} title={`Click track — ${clickBpm} BPM`} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${clickOn ? "bg-[#6C63FF] text-white" : "bg-white/10 hover:bg-white/20 text-white/80"}`}>
          <Drum className="w-3.5 h-3.5" />
          {clickOn
            ? <span className="flex items-center gap-0.5">{[0, 1, 2, 3].map(b => <span key={b} className={`w-1.5 h-1.5 rounded-full transition-colors ${beat === b ? "bg-white" : "bg-white/30"}`} />)}</span>
            : <span className="font-mono">{clickBpm}</span>}
        </button>
        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-1">
          <button onClick={() => changeFont(-2)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"><Type className="w-3 h-3" /></button>
          <button onClick={() => changeFont(2)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"><Type className="w-5 h-5" /></button>
        </div>
        <button onClick={() => setAutoScroll(a => !a)} className={`w-9 h-9 flex items-center justify-center rounded-lg ${autoScroll ? "bg-[#6C63FF] text-white" : "bg-white/10 hover:bg-white/20"}`}>{autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
        <button onClick={() => setShowSettings(true)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"><Settings className="w-4 h-4" /></button>
      </div>

      {/* Persistent sync indicator (stays visible after the controls auto-hide) */}
      {(isLeader || following) && !showControls && (
        <div className={`absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold pointer-events-none ${isLeader ? "bg-red-500/90 text-white" : "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isLeader ? "bg-white animate-pulse" : "bg-emerald-300"}`} />
          {isLeader ? "LIVE" : `Following ${leaderName}`}
        </div>
      )}

      {/* Chart */}
      <div ref={scrollRef} onScroll={onChartScroll} className="flex-1 overflow-y-auto px-8 py-6" style={{ WebkitOverflowScrolling: "touch" }}>
        {notes && (
          <div className="mb-4 flex items-start gap-2 bg-[#6C63FF]/12 border border-[#6C63FF]/30 rounded-xl px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B80FF] mt-0.5">Notes</span>
            <span className="text-sm text-white/80">{notes}</span>
          </div>
        )}
        <div style={{ fontFamily: "monospace" }}>{renderChart()}</div>
        <div className="h-40" />
      </div>

      {/* Bottom nav + setlist position */}
      <div className={`flex items-center gap-3 px-5 py-3 border-t border-white/10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={userPrev} disabled={index === 0} className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronLeft className="w-7 h-7" /></button>
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
          {setlist.map((s, i) => (
            <button key={s.id} onClick={() => gotoIndex(i)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${i === index ? "bg-[#6C63FF] text-white" : "bg-white/10 text-white/50 hover:text-white"}`}>
              {i + 1}. {s.title}
            </button>
          ))}
        </div>
        <div className="text-sm text-white/50 font-mono">{index + 1}/{setlist.length}</div>
        <button onClick={userNext} disabled={index === setlist.length - 1} className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronRight className="w-7 h-7" /></button>
      </div>

      {/* Settings / footswitch learn */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10" onClick={() => { setShowSettings(false); setLearning(null); }}>
          <div className="bg-[#1a1a24] border border-white/15 rounded-2xl p-6 w-[420px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Arrangement & Footswitch</h3>
              <button onClick={() => { setShowSettings(false); setLearning(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10"><X className="w-4 h-4" /></button>
            </div>

            {/* This song's arrangement — saved to the service so Sunday loads what you set here */}
            <div className="mb-5">
              <div className="text-sm font-semibold mb-2 truncate">{song?.title} — arrangement</div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-white/50 w-20">Key: <span className="text-[#8B80FF] font-bold font-mono">{currentKey}</span></span>
                <label className="text-xs text-white/50">BPM</label>
                <input
                  type="number" value={bpmDraft} placeholder={song?.bpm || "—"}
                  onChange={e => setBpmDraft(e.target.value)}
                  onBlur={() => onSaveArrangement?.(song.id, { bpm: bpmDraft ? Number(bpmDraft) : null })}
                  className="w-20 bg-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none focus:bg-white/15"
                />
              </div>
              <textarea
                value={noteDraft} placeholder="Arrangement notes (e.g. skip verse 2, extra chorus, key change into bridge)…"
                onChange={e => setNoteDraft(e.target.value)}
                onBlur={() => onSaveArrangement?.(song.id, { notes: noteDraft })}
                rows={2}
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:bg-white/15 resize-none placeholder:text-white/30"
              />
              <p className="text-[10px] text-white/30 mt-1">Set the key with the +/− buttons on the top bar. Everything here saves to this service.</p>
            </div>

            <div className="text-sm font-semibold mb-2 pt-4 border-t border-white/10">Footswitch</div>
            <p className="text-xs text-white/50 mb-4">Most page-turner pedals (AirTurn, PageFlip, etc.) send keystrokes. Tap “Learn,” then press your pedal to map it.</p>
            {[["next", "Next song", nextKeys], ["prev", "Previous song", prevKeys]].map(([id, label, keys]) => (
              <div key={id} className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-white/40 font-mono truncate">{keys.join(", ")}</div>
                </div>
                <button
                  onClick={() => setLearning(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${learning === id ? "bg-[#6C63FF] animate-pulse" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {learning === id ? "Press pedal…" : "Learn"}
                </button>
              </div>
            ))}
            <div className="text-xs text-white/40 mt-4 pt-4 border-t border-white/10">Also works: ← → arrows, swipe, and the on-screen buttons. Screen stays awake automatically.</div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
