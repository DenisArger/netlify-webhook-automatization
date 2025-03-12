import { sendTelegramMessage } from "../../telegram.js";
import { verifySignature } from "../../utils.js";
import {
  handleCreateEvent,
  handlePullRequestEvent,
} from "../../eventHandlers.js";

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(event, context) {
  if (event.method !== "POST") {
    console.warn("Invalid HTTP method:", event.method);
    return new Response("Method not allowed", { status: 405 });
  }

  const SECRET = process.env.WEBHOOK_SECRET;
  const signatureHeader = event.headers.get("x-hub-signature-256");
  if (!signatureHeader) {
    console.error("Missing X-Hub-Signature-256 header");
    return new Response("Missing X-Hub-Signature-256 header", { status: 400 });
  }

  const bodyString =
    typeof event.body === "string"
      ? event.body
      : await streamToString(event.body);

  if (!verifySignature(bodyString, SECRET, signatureHeader)) {
    console.error("Invalid signature detected");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(bodyString);
  } catch (error) {
    console.error("JSON parsing error:", error.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.headers.get("x-github-event");

  switch (eventType) {
    case "create":
      await handleCreateEvent(payload);
      break;
    case "pull_request":
      await handlePullRequestEvent(payload);
      break;
    case "delete":
      console.log("Processing branch/tag deletion event");
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
