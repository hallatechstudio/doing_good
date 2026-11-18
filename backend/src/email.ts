import { ServerClient } from "postmark";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  );

const linkify = (value: string) =>
  escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) =>
      `<a href="${url}" style="color:#247cff;text-decoration:underline;word-break:break-word">${url}</a>`,
  );

function actionLabel(subject: string) {
  const value = subject.toLowerCase();
  if (value.includes("password")) return "Set new password";
  if (value.includes("review delivery")) return "Review delivery";
  if (value.includes("paid for")) return "Manage this sale";
  if (value.includes("receipt")) return "View order history";
  return "Open DoingGood";
}

function emailHtml(subject: string, text: string) {
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;color:#43516a;font:16px/1.65 Arial,Helvetica,sans-serif">${linkify(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const action = urls.at(-1);
  const button = action
    ? `<p style="margin:28px 0 8px"><a href="${action}" style="display:inline-block;background:#247cff;border-radius:10px;color:#ffffff;font:700 16px/1 Arial,Helvetica,sans-serif;padding:15px 20px;text-decoration:none">${actionLabel(subject)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f6fb;padding:28px 14px;color:#101828">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #dbe3ef;border-radius:18px;overflow:hidden">
      <tr><td style="background:#07111f;padding:24px 32px"><span style="font:700 23px/1 Arial,Helvetica,sans-serif;color:#ffffff"><span style="color:#247cff">Doing</span>Good</span></td></tr>
      <tr><td style="padding:36px 32px 28px"><h1 style="margin:0 0 22px;color:#101828;font:700 28px/1.22 Arial,Helvetica,sans-serif">${escapeHtml(subject)}</h1>${paragraphs}${button}</td></tr>
      <tr><td style="border-top:1px solid #e6ebf2;padding:20px 32px"><p style="margin:0;color:#718096;font:13px/1.55 Arial,Helvetica,sans-serif">DoingGood helps people give, sell and find useful things. Please do not reply to this email.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const token = process.env["POSTMARK_SERVER_TOKEN"];
  const from = process.env["POSTMARK_FROM_EMAIL"];
  if (!token || !from)
    throw new Error(
      "Email sender is not configured. Set POSTMARK_FROM_EMAIL to a verified Postmark sender.",
    );
  const client = new ServerClient(token, { timeout: 15 });
  return client.sendEmail({
    From: from,
    To: to,
    Subject: subject,
    TextBody: text,
    HtmlBody: emailHtml(subject, text),
    MessageStream: process.env["POSTMARK_MESSAGE_STREAM"] || "outbound",
  });
}
