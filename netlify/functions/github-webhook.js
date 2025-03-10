const { sendTelegramMessage } = require("../../telegram");
const { verifySignature } = require("../../utils");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed",
    };
  }

  const SECRET = process.env.WEBHOOK_SECRET;
  const signatureHeader =
    event.headers["x-hub-signature-256"] ||
    event.headers["X-Hub-Signature-256"];

  if (!signatureHeader) {
    return {
      statusCode: 400,
      body: "Missing X-Hub-Signature-256 header",
    };
  }

  if (!verifySignature(event.body, SECRET, signatureHeader)) {
    return {
      statusCode: 401,
      body: "Invalid signature",
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: "Invalid JSON",
    };
  }

  const eventType =
    event.headers["x-github-event"] || event.headers["X-GitHub-Event"];
  console.log(`Received event: ${eventType}`);

  if (eventType === "create") {
    console.log("Processing branch creation event (In Progress)");
  } else if (eventType === "delete") {
    console.log("Processing branch/tag deletion event");
  } else if (eventType === "pull_request") {
    console.log("Processing pull_request event (Review)");
  } else if (eventType === "pull_request_review") {
    console.log("Processing pull_request_review event (approval check)");
  } else if (eventType === "push") {
    console.log("Processing push event (commits to branch)");
  } else {
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

  return {
    statusCode: 200,
    body: "Event processed",
  };
};
