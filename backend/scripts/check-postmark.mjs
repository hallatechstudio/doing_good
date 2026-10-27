import "dotenv/config";
const accountHeaders = {
  Accept: "application/json",
  "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN || "",
};
const serverHeaders = {
  Accept: "application/json",
  "X-Postmark-Server-Token": process.env.POSTMARK_SERVER_TOKEN || "",
};
let failed = false;
try {
  const response = await fetch("https://api.postmarkapp.com/server", { headers: serverHeaders });
  const server = await response.json();
  console.log(
    JSON.stringify({
      check: "server-token",
      status: response.status,
      name: server.Name,
      deliveryType: server.DeliveryType,
    }),
  );
  if (!response.ok) failed = true;
  const streamsResponse = await fetch("https://api.postmarkapp.com/message-streams", {
    headers: serverHeaders,
  });
  const streams = await streamsResponse.json();
  const stream = streams.MessageStreams?.find(
    (s) => s.ID === (process.env.POSTMARK_MESSAGE_STREAM || "outbound"),
  );
  console.log(
    JSON.stringify({
      check: "message-stream",
      status: streamsResponse.status,
      found: Boolean(stream),
      type: stream?.MessageStreamType,
    }),
  );
  if (!streamsResponse.ok || !stream) failed = true;
  if (process.env.POSTMARK_ACCOUNT_TOKEN) {
    const response = await fetch("https://api.postmarkapp.com/senders?count=100&offset=0", {
      headers: accountHeaders,
    });
    const body = await response.json();
    const sender = body.SenderSignatures?.find(
      (s) => s.EmailAddress === process.env.POSTMARK_FROM_EMAIL,
    );
    console.log(
      JSON.stringify({
        check: "sender",
        status: response.status,
        email: sender?.EmailAddress,
        confirmed: sender?.Confirmed ?? false,
      }),
    );
    if (!response.ok || !sender?.Confirmed) failed = true;
  }
  // Postmark's documented test token validates the payload without delivering email.
  const validation = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": "POSTMARK_API_TEST",
    },
    body: JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL,
      To: "test@example.com",
      Subject: "DoingGood configuration test",
      TextBody: "Configuration validation only; no email is delivered.",
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
    }),
  });
  const result = await validation.json();
  console.log(
    JSON.stringify({
      check: "payload-validation-no-delivery",
      status: validation.status,
      errorCode: result.ErrorCode,
    }),
  );
  if (!validation.ok || result.ErrorCode !== 0) failed = true;
} catch {
  console.error("Postmark configuration check could not connect.");
  failed = true;
}
if (failed) process.exitCode = 1;
