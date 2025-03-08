const crypto = require("crypto");

exports.handler = async (event, context) => {
  // Проверка метода запроса
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

  // Вычисление HMAC на основе тела запроса
  const hmac = crypto.createHmac("sha256", SECRET);
  // event.body — строка, поэтому используем её напрямую
  hmac.update(event.body, "utf8");
  const digest = "sha256=" + hmac.digest("hex");

  if (digest !== signatureHeader) {
    return {
      statusCode: 401,
      body: "Неверная подпись",
    };
  }

  // Попытка распарсить JSON-пейлоад
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: "Неверный JSON",
    };
  }

  // Определение типа события из заголовка
  const eventType =
    event.headers["x-github-event"] || event.headers["X-GitHub-Event"];
  console.log(`Получено событие: ${eventType}`);

  // Пример обработки событий
  if (eventType === "create") {
    console.log(
      "Обработка события создания ветки для перевода карточки в In Progress"
    );
    // Здесь разместите логику для перемещения карточки
  } else if (eventType === "pull_request") {
    console.log(
      "Обработка события pull_request для перевода карточки в Review"
    );
    // Здесь разместите логику для перемещения карточки
  } else if (eventType === "review") {
    console.log("Обработка события review для проверки одобрений");
    // Здесь разместите логику для перемещения карточки в Done
  } else {
    console.log("Необработанный тип события:", eventType);
  }

  // Возвращаем успешный ответ
  return {
    statusCode: 200,
    body: "Событие обработано",
  };
};
