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

module.exports = {
  sendTelegramMessage,
};
