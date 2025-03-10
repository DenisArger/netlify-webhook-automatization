import { sendTelegramMessage } from "../../telegram.js";
import { verifySignature } from "../../utils.js";

export default async function handler(event, context) {
  console.log("Received event:", event);

  if (event.method !== "POST") {
    console.warn("Invalid HTTP method:", event.httpMethod);
    return new Response("Method not allowed", { status: 405 });
  }
  console.log("1Received headers:", headers);

  const SECRET = process.env.WEBHOOK_SECRET;

  // Нормализация заголовков
  const headers = Object.keys(event.headers).reduce((acc, key) => {
    acc[key.toLowerCase()] = event.headers[key];
    return acc;
  }, {});

  console.log("Received headers:", headers);

  const signatureHeader = headers["x-hub-signature-256"];

  if (!signatureHeader) {
    console.error("Missing X-Hub-Signature-256 header");
    return new Response("Missing X-Hub-Signature-256 header", { status: 400 });
  }

  if (!verifySignature(event.body, SECRET, signatureHeader)) {
    console.error("Invalid signature detected");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    console.log("Raw event body:", event.body);
    payload = JSON.parse(event.body);
  } catch (error) {
    console.error("JSON parsing error:", error.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = headers["x-github-event"];
  console.log(`Received GitHub event: ${eventType}`);

  switch (eventType) {
    case "create":
      console.log("Processing branch creation event (In Progress)");
      break;
    case "delete":
      console.log("Processing branch/tag deletion event");
      break;
    case "pull_request":
      console.log("Processing pull_request event (Review)");
      break;
    case "pull_request_review":
      console.log("Processing pull_request_review event (approval check)");
      break;
    case "push":
      console.log("Processing push event (commits to branch)");
      break;
    default:
      console.log("Unhandled event type:", eventType);
  }

  try {
    await sendTelegramMessage(
      `Received event: ${eventType}\n` +
        `Repository: ${payload?.repository?.full_name || "unknown"}\n` +
        `Additional data: ${JSON.stringify(payload, null, 2).slice(0, 500)}...`
    );
  } catch (err) {
    console.error("Error sending to Telegram:", err);
  }

  return new Response("Event processed", { status: 200 });
}
