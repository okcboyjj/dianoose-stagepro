const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const APP_NAME = "Dianoose Stage";
const SENDER = `${APP_NAME} <noreply@dianoosestage.com>`;
const CONTINUE_URL = "https://dianoosestage.netlify.app/";
const RESET_CONTINUE_URL = "https://dianoosestage.netlify.app/reset-password";

function buildEmailHtml({ heading, bodyText, link, buttonLabel }) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; color: #111;">${heading}</h1>
      <p style="font-size: 14px; color: #444; line-height: 1.5;">${bodyText}</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #6C63FF; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">${buttonLabel}</a>
      </p>
      <p style="font-size: 12px; color: #888;">If the button doesn't work, copy and paste this link into your browser:<br>${link}</p>
      <p style="font-size: 12px; color: #888; margin-top: 24px;">— The ${APP_NAME} team</p>
    </div>
  `;
}

async function sendViaResend({ apiKey, to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: SENDER, to: [to], subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new HttpsError("internal", `Resend send failed: ${res.status} ${errText}`);
  }
}

function createSendAuthEmail(RESEND_API_KEY) {
  return onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
    const { type, email } = request.data || {};
    if (!email || !["verify", "reset"].includes(type)) {
      throw new HttpsError("invalid-argument", "type ('verify'|'reset') and email are required");
    }

    let link;
    try {
      link =
        type === "verify"
          ? await admin.auth().generateEmailVerificationLink(email, { url: CONTINUE_URL })
          : await admin.auth().generatePasswordResetLink(email, { url: RESET_CONTINUE_URL });
    } catch (e) {
      // Don't leak whether the account exists — behave like a normal success either way.
      if (e?.code === "auth/user-not-found") return { success: true };
      throw new HttpsError("internal", e?.message || "Failed to generate link");
    }

    const html =
      type === "verify"
        ? buildEmailHtml({
            heading: "Verify your email",
            bodyText: `Click the button below to verify your email address for ${APP_NAME}.`,
            link,
            buttonLabel: "Verify Email",
          })
        : buildEmailHtml({
            heading: "Reset your password",
            bodyText: `Click the button below to set a new password for your ${APP_NAME} account.`,
            link,
            buttonLabel: "Reset Password",
          });

    await sendViaResend({
      apiKey: RESEND_API_KEY.value(),
      to: email,
      subject: type === "verify" ? `Verify your email for ${APP_NAME}` : `Reset your password for ${APP_NAME}`,
      html,
    });

    return { success: true };
  });
}

module.exports = { createSendAuthEmail };
