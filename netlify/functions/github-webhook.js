import { moveTaskToInProgress } from "../../taskMover.js";
import { sendTelegramMessage } from "../../telegram.js";
import { verifySignature } from "../../utils.js";

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(event, context) {
  if (event.method !== "POST") {
    console.warn("Invalid HTTP method:", event.httpMethod);
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
    console.log("Raw event body:", bodyString);
    payload = JSON.parse(bodyString);
  } catch (error) {
    console.error("JSON parsing error:", error.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.headers.get("x-github-event");

  switch (eventType) {
    case "create":
      console.log("Processing branch creation event (In Progress)");

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
            `⚠️ Branch name "${branchName}" does not correspond to the expected pattern.`
          );
        }
      }
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
