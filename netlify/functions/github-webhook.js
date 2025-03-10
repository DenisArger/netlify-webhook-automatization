const { sendTelegramMessage } = require("../../telegram");
const { verifySignature } = require("../../utils");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Метод не поддерживается",
    };
  }

  const SECRET = process.env.WEBHOOK_SECRET;
  const signatureHeader =
    event.headers["x-hub-signature-256"] ||
    event.headers["X-Hub-Signature-256"];

  if (!signatureHeader) {
    return {
      statusCode: 400,
      body: "Отсутствует заголовок X-Hub-Signature-256",
    };
  }

  if (!verifySignature(event.body, SECRET, signatureHeader)) {
    return {
      statusCode: 401,
      body: "Неверная подпись",
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: "Неверный JSON",
    };
  }

  const eventType =
    event.headers["x-github-event"] || event.headers["X-GitHub-Event"];
  console.log(`Получено событие: ${eventType}`);

  if (eventType === "create") {
    console.log("Обработка события создания ветки (In Progress)");
  } else if (eventType === "delete") {
    console.log("Обработка события удаления ветки/тега");
  } else if (eventType === "pull_request") {
    console.log("Обработка события pull_request (Review)");
  } else if (eventType === "pull_request_review") {
    console.log("Обработка события pull_request_review (проверка одобрений)");
  } else if (eventType === "push") {
    console.log("Обработка события push (коммиты в ветку)");
  } else {
    console.log("Необработанный тип события:", eventType);
  }

  try {
    await sendTelegramMessage(
      `Получено событие: ${eventType}\n` +
        `Репозиторий: ${payload?.repository?.full_name || "неизвестно"}\n` +
        `Доп. данные: ${JSON.stringify(payload, null, 2).slice(0, 500)}...`
    );
  } catch (err) {
    console.error("Ошибка при отправке в Telegram:", err);
  }

  return {
    statusCode: 200,
    body: "Событие обработано",
  };
};
