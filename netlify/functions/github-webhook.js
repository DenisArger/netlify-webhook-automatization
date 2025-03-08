const crypto = require("crypto");

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

  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(event.body, "utf8");
  const digest = "sha256=" + hmac.digest("hex");

  if (digest !== signatureHeader) {
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

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const messageThreadId = process.env.TELEGRAM_TOPIC_ID;

  if (!token || !chatId) {
    throw new Error(
      "Отсутствуют TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения"
    );
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text,
  };

  if (messageThreadId) {
    body.message_thread_id = Number(messageThreadId);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Не удалось отправить сообщение в Telegram: ${errorBody}`);
  }
}
