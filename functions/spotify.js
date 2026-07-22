async function getSpotifyToken({ clientId, clientSecret }) {
  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify client ID/secret");
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.access_token;
}

module.exports = { getSpotifyToken };
