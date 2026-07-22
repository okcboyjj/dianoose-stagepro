const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const { callGemini, gcsUriFromDownloadUrl } = require("./gemini");
const { getSpotifyToken } = require("./spotify");
const { createSendAuthEmail } = require("./authEmail");

const SPOTIFY_CLIENT_ID = defineSecret("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = defineSecret("SPOTIFY_CLIENT_SECRET");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// ─── sendAuthEmail — verification/reset emails via Resend (Firebase's own default──────────────
// mailer has unreliable Gmail deliverability; custom SMTP relay requires the paid Identity
// Platform upgrade). Intentionally unauthenticated: password-reset must work for a signed-out user.
exports.sendAuthEmail = createSendAuthEmail(RESEND_API_KEY);

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
}

// ─── invokeLLM — generic text-prompt JSON parser (used by the paste-chart-text import) ───────
exports.invokeLLM = onCall(async (request) => {
  requireAuth(request);
  const { prompt, file_urls } = request.data || {};
  if (!prompt) throw new HttpsError("invalid-argument", "prompt is required");

  const fileUrl = file_urls?.[0];
  const { gcsUri } = fileUrl ? gcsUriFromDownloadUrl(fileUrl) : {};

  return callGemini({ prompt, fileUri: gcsUri });
});

// ─── spotifySearch — track lookup for the "add song" flow ────────────────────────────────────
exports.spotifySearch = onCall(
  { secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET] },
  async (request) => {
    requireAuth(request);
    const query = (request.data?.query || "").trim();
    if (query.length < 2) return { results: [] };

    const token = await getSpotifyToken({
      clientId: SPOTIFY_CLIENT_ID.value(),
      clientSecret: SPOTIFY_CLIENT_SECRET.value(),
    });

    const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
    const searchRes = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (searchRes.status === 429) {
      const retryAfter = searchRes.headers.get("retry-after");
      throw new HttpsError(
        "resource-exhausted",
        "Spotify is rate limiting searches right now. Try again in a little bit.",
        { retry_after: retryAfter ? Number(retryAfter) : null }
      );
    }
    if (!searchRes.ok) {
      throw new HttpsError("internal", `Spotify API error: ${searchRes.status}`);
    }

    const data = await searchRes.json();
    const tracks = data?.tracks?.items || [];
    const results = tracks.map((track) => ({
      spotify_id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      artwork_url: track.album.images?.[0]?.url || null,
      artwork_url_small: track.album.images?.[2]?.url || null,
      spotify_url: track.external_urls?.spotify || null,
      preview_url: track.preview_url || null,
      duration_ms: track.duration_ms,
    }));

    return { results };
  }
);

// ─── ocrChartImport — the core differentiator: chart photo → structured chord chart,──────────
// with English/Malayalam/Manglish detection and Manglish→Malayalam Unicode conversion.
exports.ocrChartImport = onCall({ timeoutSeconds: 120 }, async (request) => {
  requireAuth(request);
  const { file_url } = request.data || {};
  if (!file_url) throw new HttpsError("invalid-argument", "file_url is required");

  const { gcsUri, bucket, path } = gcsUriFromDownloadUrl(file_url);
  const [metadata] = await admin.storage().bucket(bucket).file(path).getMetadata();
  const mimeType = metadata.contentType || "image/jpeg";

  const mainPrompt = `You are a worship chart OCR specialist. Extract ALL content from this worship chart image.

LANGUAGE DETECTION — critically important:
First, detect what language(s) the lyrics are written in:
- "English": lyrics are standard English words
- "Malayalam": lyrics are Malayalam Unicode script (ക, ത, etc.)
- "Manglish": Malayalam words phonetically written in English letters (e.g. "Njan ninne sthuthikkum", "Yeshu entae daivam")
- "Mixed": contains both English and Malayalam/Manglish sections

Set the "detected_language_type" field to one of: "English", "Malayalam", "Manglish", "Mixed"
Set the "language" field to: "English" for English, "Malayalam" for Malayalam/Manglish/Mixed

Return a JSON object with:
- title: string or null
- artist: string or null
- key: string (e.g. "G", "Am", "F#") or null
- bpm: number or null
- capo: number or null
- time_signature: string (e.g. "4/4") or null
- language: "English" or "Malayalam"
- detected_language_type: "English", "Malayalam", "Manglish", or "Mixed"
- lyrics: string — full lyrics without chords, sections separated by blank lines
- confidence_notes: string — any OCR issues, uncertain content, or language detection notes
- sections: array of section objects in order:
    {
      "name": string,
      "lines": [
        {
          "lyric": string,
          "chords": [ { "chord": string, "word_index": number } ]
        }
      ]
    }
  Each line has the lyric text AND any chords mapped to word positions (0 = first word).
  chord is the exact symbol (G, D/F#, F#m7, Bb, Em7, Asus2 etc.).
  If a line has no chords, chords = [].

Rules:
- NEVER fabricate content — only extract what is visible in the image
- Section names go in name field, NOT in lyric text
- Handwritten chords ALWAYS override any printed chord beneath them
- Nashville numbers (1, 4, 5, 6m) are valid chords
- Slash chords like G/B are one chord symbol
- If lyrics are already Malayalam Unicode, preserve them exactly as-is
- If lyrics are English, do NOT add Malayalam fields

Respond with JSON only.`;

  const mainResult = await callGemini({ prompt: mainPrompt, fileUri: gcsUri, mimeType });
  const detectedType = mainResult.detected_language_type || "English";
  const rawLyrics = mainResult.lyrics || "";
  let malayalamResult = null;

  if (rawLyrics && (detectedType === "Manglish" || detectedType === "Mixed")) {
    const conversionPrompt =
      detectedType === "Manglish"
        ? `You are a Manglish to Malayalam script converter for Christian worship songs.

The following lyrics are written in Manglish (Malayalam phonetics in English letters). Convert them directly into proper Malayalam Unicode script. Do NOT translate — just convert the phonetics to script.

Preserve all section labels (Verse 1, Chorus, Bridge etc.) and line breaks exactly.

Manglish lyrics:
${rawLyrics}

Return JSON: { "malayalam_lyrics": string, "transliteration_lyrics": string }
- transliteration_lyrics = the original Manglish text (copy it as-is)
- malayalam_lyrics = the Malayalam Unicode script version`
        : `You are a Malayalam/English mixed text processor for Christian worship songs.

The following lyrics contain both English and Manglish (Malayalam phonetics in English letters) sections.
- Convert any Manglish portions to Malayalam Unicode script.
- Keep English portions as-is in the transliteration field.
- Preserve all section labels and line breaks exactly.

Lyrics:
${rawLyrics}

Return JSON: { "malayalam_lyrics": string, "transliteration_lyrics": string }
- transliteration_lyrics = original text with English kept as-is
- malayalam_lyrics = Manglish converted to Unicode, English kept as-is`;

    malayalamResult = await callGemini({ prompt: conversionPrompt }).catch(() => null);
  }

  const chordMaps = [];
  let lineIdx = 0;
  for (const section of mainResult.sections || []) {
    for (const line of section.lines || []) {
      for (const c of line.chords || []) {
        chordMaps.push({ line_index: lineIdx, chord: c.chord, word_index: c.word_index });
      }
      lineIdx++;
    }
  }

  function buildChartContent(sections, allChordMaps) {
    const chordsByLine = {};
    for (const cm of allChordMaps || []) {
      if (!chordsByLine[cm.line_index]) chordsByLine[cm.line_index] = [];
      chordsByLine[cm.line_index].push(cm);
    }

    let li = 0;
    let chart = "";
    for (const section of sections || []) {
      chart += `[${section.name}]\n`;
      for (const lineObj of section.lines || []) {
        const lyric = lineObj.lyric || "";
        const chords = chordsByLine[li] || [];

        if (chords.length === 0) {
          chart += lyric + "\n";
        } else {
          const words = lyric.split(" ");
          const wordOffsets = [];
          let offset = 0;
          for (const w of words) {
            wordOffsets.push(offset);
            offset += w.length + 1;
          }
          let chordLine = "";
          const sortedChords = [...chords].sort((a, b) => a.word_index - b.word_index);
          for (const cm of sortedChords) {
            const pos = wordOffsets[Math.min(cm.word_index, wordOffsets.length - 1)] || 0;
            while (chordLine.length < pos) chordLine += " ";
            chordLine += cm.chord + " ";
          }
          chart += chordLine.trimEnd() + "\n";
          chart += lyric + "\n";
        }
        li++;
      }
      chart += "\n";
    }
    return chart.trim();
  }

  const chart_content = buildChartContent(mainResult.sections, chordMaps);

  let finalMalayalam = "";
  let finalTranslit = "";
  if (detectedType === "Malayalam") {
    finalMalayalam = rawLyrics;
  } else if (detectedType === "Manglish" || detectedType === "Mixed") {
    finalMalayalam = (malayalamResult?.malayalam_lyrics || "").trim();
    finalTranslit = (malayalamResult?.transliteration_lyrics || "").trim() || rawLyrics;
  }

  return {
    ...mainResult,
    chart_content,
    malayalam_lyrics: finalMalayalam,
    transliteration_lyrics: finalTranslit,
    source_type: "OCR Import",
    import_date: new Date().toISOString(),
  };
});

// ─── bulkImportGlobalSongs — admin tool: seed the shared catalog from Spotify metadata ────────
const {
  normalize,
  confidentSpotifyMatch,
  stylePatchNotes,
  youtubeSearchUrl,
  spotifyKey,
  getPlaylistTracks,
  getAudioFeatures,
} = require("./bulkImportHelpers");

exports.bulkImportGlobalSongs = onCall(
  { secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET], timeoutSeconds: 300 },
  async (request) => {
    requireAuth(request);
    const { songs = [], playlists = [], dry_run: dryRun = false, limit: limitInput } = request.data || {};

    if (songs.length === 0 && playlists.length === 0) {
      throw new HttpsError("invalid-argument", "songs or playlists array is required");
    }
    const limit = Math.min(Number(limitInput || songs.length || 0) || 500, 500);

    const db = admin.firestore();
    const existingSnap = await db.collection("globalSongs").orderBy("created_date", "desc").limit(2000).get();
    const existingKeys = new Set(
      existingSnap.docs.map((doc) => {
        const song = doc.data();
        return `${normalize(song.title)}|${normalize((song.artist || "").split(",")[0])}`;
      })
    );

    const token = await getSpotifyToken({
      clientId: SPOTIFY_CLIENT_ID.value(),
      clientSecret: SPOTIFY_CLIENT_SECRET.value(),
    });

    const imported = [];
    const skipped = [];
    const failed = [];

    async function createGlobalSong(payload) {
      const now = new Date().toISOString();
      const ref = await db.collection("globalSongs").add({ ...payload, created_date: now, updated_date: now });
      return { id: ref.id };
    }

    async function findSpotifyTrack(seed) {
      const query = `${seed.title} ${seed.artist || ""}`.trim();
      const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
      const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Spotify search error ${res.status}`);
      const data = await res.json();
      const tracks = data?.tracks?.items || [];
      const title = normalize(seed.title);
      const artist = normalize((seed.artist || "").split(",")[0]);
      return (
        tracks.find((t) => normalize(t.name) === title && normalize(t.artists.map((a) => a.name).join(" ")).includes(artist)) ||
        tracks.find((t) => normalize(t.name).includes(title) && normalize(t.artists.map((a) => a.name).join(" ")).includes(artist)) ||
        tracks[0] ||
        null
      );
    }

    const playlistTracks = [];
    for (const playlist of playlists) {
      try {
        const tracks = await getPlaylistTracks(token, playlist);
        for (const track of tracks) playlistTracks.push({ track, playlist });
      } catch (error) {
        failed.push({ title: playlist.label || playlist.id, reason: error?.message || String(error) });
      }
    }

    const audioFeatures = await getAudioFeatures(token, playlistTracks.map((item) => item.track));

    for (const item of playlistTracks) {
      if (imported.length >= limit) break;
      const { track, playlist } = item;
      const spotifyArtist = track.artists.map((a) => a.name).join(", ");
      const duplicateKey = `${normalize(track.name)}|${normalize((spotifyArtist || "").split(",")[0])}`;

      if (existingKeys.has(duplicateKey)) {
        skipped.push({ title: track.name, reason: "Duplicate" });
        continue;
      }

      const feature = audioFeatures.get(track.id);
      const seed = {
        title: track.name,
        artist: spotifyArtist,
        key: spotifyKey(feature),
        bpm: feature?.tempo ? Math.round(feature.tempo) : null,
        time_signature: feature?.time_signature ? `${feature.time_signature}/4` : "4/4",
        category: playlist.category || "Worship",
        tags: playlist.tags || [],
      };
      const patches = stylePatchNotes(seed);
      const payload = {
        title: track.name,
        artist: spotifyArtist,
        album: track.album.name,
        artwork_url: track.album.images?.[0]?.url || "",
        spotify_url: track.external_urls?.spotify || "",
        youtube_url: youtubeSearchUrl(track.name, spotifyArtist),
        key: seed.key || "",
        bpm: seed.bpm || null,
        time_signature: seed.time_signature || "",
        capo: 0,
        category: seed.category || "Worship",
        tags: Array.from(new Set([...(seed.tags || []), "global-catalog", "spotify-verified", "spotify-playlist-import", "youtube-search", "needs-chart"])),
        chart_content: "",
        guitar_patch_notes: patches.guitar,
        keys_patch_notes: patches.keys,
        production_notes: `Imported from Spotify playlist${playlist.label ? `: ${playlist.label}` : ""}. Chart still needs manual licensed entry.`,
        is_active: true,
        is_verified: true,
        language: "English",
        verified_status: "Verified",
        source_url: track.external_urls?.spotify || "",
        source_notes: `Spotify playlist metadata imported from track ${track.id}. YouTube link is a search link.`,
      };

      if (!dryRun) {
        const created = await createGlobalSong(payload);
        imported.push({ id: created.id, title: payload.title, artist: payload.artist });
        existingKeys.add(duplicateKey);
      } else {
        imported.push({ title: payload.title, artist: payload.artist, dry_run: true });
      }
    }

    for (const seed of songs) {
      if (imported.length >= limit) break;
      if (!seed?.title) {
        failed.push({ title: seed?.title || "(missing title)", reason: "Missing title" });
        continue;
      }

      const duplicateKey = `${normalize(seed.title)}|${normalize((seed.artist || "").split(",")[0])}`;
      if (existingKeys.has(duplicateKey)) {
        skipped.push({ title: seed.title, reason: "Duplicate" });
        continue;
      }

      try {
        const track = await findSpotifyTrack(seed);
        if (!confidentSpotifyMatch(seed, track)) {
          failed.push({ title: seed.title, reason: "Skipped: no high-confidence Spotify match" });
          continue;
        }

        const spotifyArtist = track.artists.map((a) => a.name).join(", ");
        const patches = stylePatchNotes(seed);
        const payload = {
          title: track.name,
          artist: spotifyArtist,
          album: track.album.name,
          artwork_url: track.album.images?.[0]?.url || "",
          spotify_url: track.external_urls?.spotify || "",
          youtube_url: youtubeSearchUrl(track.name, spotifyArtist),
          key: seed.key || "",
          bpm: seed.bpm || null,
          time_signature: seed.time_signature || "4/4",
          capo: 0,
          category: seed.category || "Worship",
          tags: Array.from(new Set([...(seed.tags || []), "global-catalog", "spotify-verified", "youtube-search", "needs-chart"])),
          chart_content: "",
          guitar_patch_notes: seed.guitar_patch_notes || patches.guitar,
          keys_patch_notes: seed.keys_patch_notes || patches.keys,
          production_notes:
            seed.production_notes || "Imported for global catalog. Spotify metadata/artwork verified. Chart still needs manual licensed entry.",
          is_active: true,
          is_verified: true,
          language: seed.language || "English",
          verified_status: "Verified",
          source_url: track.external_urls?.spotify || "",
          source_notes: `Spotify metadata imported from track ${track.id}. YouTube link is a search link.`,
        };

        if (!dryRun) {
          const created = await createGlobalSong(payload);
          imported.push({ id: created.id, title: payload.title, artist: payload.artist });
          existingKeys.add(duplicateKey);
        } else {
          imported.push({ title: payload.title, artist: payload.artist, dry_run: true });
        }
      } catch (error) {
        failed.push({ title: seed.title, reason: error?.message || String(error) });
      }
    }

    return {
      imported_count: imported.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      imported,
      skipped,
      failed,
    };
  }
);
