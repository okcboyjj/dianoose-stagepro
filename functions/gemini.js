const { GoogleGenAI } = require("@google/genai");

const PROJECT_ID = "dianoose";
const LOCATION = "us-central1";
const DEFAULT_MODEL = "gemini-2.5-pro";

// Cloud Functions' own service account authenticates automatically (Application Default
// Credentials via the Vertex AI backend) — no API key/secret needed.
const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: LOCATION });

// Vertex AI's Gemini only accepts images/PDFs via a gs:// URI or inline bytes — not arbitrary
// HTTPS URLs — so callers must resolve the Firebase Storage download URL to a gs:// URI first
// (see gcsUriFromDownloadUrl below) and pass it as `fileUri`.
async function callGemini({ prompt, fileUri, mimeType, model = DEFAULT_MODEL }) {
  const parts = [{ text: prompt }];
  if (fileUri) {
    parts.push({ fileData: { fileUri, mimeType: mimeType || "image/jpeg" } });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

// Firebase Storage download URLs look like:
//   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
function gcsUriFromDownloadUrl(url) {
  const match = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
  if (!match) throw new Error("Could not parse Firebase Storage URL: " + url);
  const bucket = match[1];
  const path = decodeURIComponent(match[2]);
  return { gcsUri: `gs://${bucket}/${path}`, bucket, path };
}

module.exports = { callGemini, gcsUriFromDownloadUrl };
