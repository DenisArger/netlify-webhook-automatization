import { moveTaskToInProgress } from "../../taskMover.js";
import { sendTelegramMessage } from "../../telegram.js";
import { verifySignature } from "../../utils.js";
import("../../logger.js");

export default async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SECRET = process.env.WEBHOOK_SECRET;
  const signatureHeader =
    event.headers["x-hub-signature-256"] ||
    event.headers["X-Hub-Signature-256"];

  if (!signatureHeader) {
    return new Response("Missing X-Hub-Signature-256 header", { status: 400 });
  }

  if (!verifySignature(event.body, SECRET, signatureHeader)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType =
    event.headers["x-github-event"] || event.headers["X-GitHub-Event"];
  console.log(`Received event: ${eventType}`);

  if (eventType === "create") {
    if (payload.ref_type === "branch") {
      const branchName = payload.ref;

      const branchRegex = /^(feature|fix)-[a-z]+-(\d+)-[a-z0-9-]+$/i;
      const match = branchName.match(branchRegex);

      if (match) {
        const issueNumber = match[2];
        console.log(
          `Extracted issue number ${issueNumber} from branch ${branchName}`
        );
        try {
          const result = await moveTaskToInProgress(issueNumber);
          const statusMessage = result.alreadyInProgress
            ? `⚠️ Задача ${issueNumber} уже в статусе IN_PROGRESS.`
            : `✅ Задача ${issueNumber} успешно перемещена в IN_PROGRESS.`;

          console.log(statusMessage);

          await sendTelegramMessage(
            `🔔 GitHub Webhook: ${eventType}\n` +
              `📂 Репозиторий: ${
                payload?.repository?.full_name || "unknown"
              }\n` +
              `🔢 Номер задачи: ${issueNumber}\n` +
              `🔗 Ссылка: ${result.issueUrl || "нет данных"}\n` +
              `${statusMessage}`
          );
        } catch (err) {
          console.error(
            `❌ Ошибка при перемещении задачи ${issueNumber} в IN_PROGRESS:`,
            err
          );
          await sendTelegramMessage(
            `❌ Ошибка при обновлении задачи ${issueNumber}: ${err.message}`
          );
        }
      } else {
        console.log(
          `⚠️ Branch name "${branchName}" does not соответств the expected pattern.`
        );
      }
    }
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
    return new Response("Error sending Telegram message", { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Event processed" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
