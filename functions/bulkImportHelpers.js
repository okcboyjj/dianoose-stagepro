const KEY_NAMES_MAJOR = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const KEY_NAMES_MINOR = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];

function normalize(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeTitle(value = "") {
  return normalize(value)
    .replace(/\b(live|radio|edit|version|acoustic|studio|single|feat|featuring|ft|remastered|spontaneous)\b/g, " ")
    .replace(/\bfrom\s+the\s+.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function confidentSpotifyMatch(seed, track) {
  if (!track) return false;

  const seedTitle = normalizeTitle(seed.title);
  const seedArtist = normalize((seed.artist || "").split(",")[0]);
  const trackTitle = normalizeTitle(track.name);
  const trackArtists = normalize(track.artists.map((a) => a.name).join(" "));
  const titleMatches = trackTitle === seedTitle || trackTitle.includes(seedTitle) || seedTitle.includes(trackTitle);
  const artistMatches =
    !seedArtist || trackArtists.includes(seedArtist) || seedArtist.includes(trackArtists.split(" ")[0] || "");

  return titleMatches || (artistMatches && seedTitle.split(" ").some((word) => word.length > 4 && trackTitle.includes(word)));
}

function youtubeSearchUrl(title, artist = "") {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`.trim())}`;
}

function spotifyKey(feature) {
  if (!feature || feature.key === undefined || feature.key < 0) return "";
  return feature.mode === 0 ? KEY_NAMES_MINOR[feature.key] : KEY_NAMES_MAJOR[feature.key];
}

function stylePatchNotes(song) {
  const text = `${song.title} ${song.artist || ""}`.toLowerCase();

  if (text.includes("rattle") || text.includes("praise") || text.includes("house")) {
    return {
      guitar:
        "Song-specific starting point: high-energy rhythm guitar, tight palm-muted groove in lower sections, crunchy drive for big choruses, and octave/lead accents where the arrangement lifts.",
      keys:
        "Song-specific starting point: rhythmic piano or organ support, bright pad layers for choruses, and subtle risers/synth texture for high-energy transitions.",
    };
  }

  if (text.includes("blessing") || text.includes("goodness") || text.includes("worthy") || text.includes("believe")) {
    return {
      guitar:
        "Song-specific starting point: sparse clean electric or acoustic early, volume swells, shimmer reverb, dotted eighth delay, and gradual overdrive only on the biggest build.",
      keys:
        "Song-specific starting point: intimate piano and warm pad, soft strings under choruses, wider cinematic pad for final builds, and gentle arpeggios that leave room for vocals.",
    };
  }

  if (text.includes("hymn") || text.includes("grace") || text.includes("christ in me")) {
    return {
      guitar:
        "Song-specific starting point: clean acoustic or electric support, hymn-like steady strumming or light arpeggios, minimal effects, and dynamics focused on congregational singing.",
      keys: "Song-specific starting point: piano-led modern hymn texture, subtle pad, restrained strings, and clean voicings that keep the lyric clear.",
    };
  }

  return {
    guitar:
      "Song-specific starting point: clean electric with light compression, delay matched to the song tempo, ambient swells in quiet sections, and mild drive for final choruses.",
    keys: "Song-specific starting point: piano and warm pad foundation, soft strings for lift, wider synth pad on builds, and restrained movement to support the vocal melody.",
  };
}

async function getPlaylistTracks(token, playlist) {
  const tracks = [];
  let next = `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&fields=next,items(track(id,name,artists(name),album(name,images),external_urls,duration_ms))`;

  while (next && tracks.length < 500) {
    const response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Spotify playlist error ${response.status}`);
    const data = await response.json();
    for (const item of data?.items || []) {
      if (item?.track?.id && item.track.name) tracks.push(item.track);
    }
    next = data?.next || null;
  }

  return tracks;
}

async function getAudioFeatures(token, tracks) {
  const features = new Map();

  for (let i = 0; i < tracks.length; i += 100) {
    const ids = tracks
      .slice(i, i + 100)
      .map((t) => t.id)
      .join(",");
    if (!ids) continue;

    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) continue;
    const data = await response.json();
    for (const feature of data?.audio_features || []) {
      if (feature?.id) features.set(feature.id, feature);
    }
  }

  return features;
}

module.exports = {
  normalize,
  normalizeTitle,
  confidentSpotifyMatch,
  youtubeSearchUrl,
  spotifyKey,
  stylePatchNotes,
  getPlaylistTracks,
  getAudioFeatures,
};
