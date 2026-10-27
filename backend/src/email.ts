import { ServerClient } from "postmark";

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
    MessageStream: process.env["POSTMARK_MESSAGE_STREAM"] || "outbound",
  });
}
