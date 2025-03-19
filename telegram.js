import { githubToTelegramMap } from "./config.js";

/**
 * Отправка сообщения в Telegram с гибкой настройкой параметров.
 * @param {string} text - Текст сообщения.
 * @param {object} options - Объект опций для настройки отправки.
 *   debug {boolean} - Если true, используются переменные для отладки.
 *   token {string} - Токен бота (если нужно переопределить).
 *   chatId {string|number} - ID чата (если нужно переопределить).
 *   messageThreadId {string|number} - ID темы сообщения (если нужно переопределить).
 *   parse_mode {string} - Режим парсинга (например, "Markdown").
 *   disable_notification {boolean} - Отключить уведомления.
 */
async function sendTelegramMessage(text, options = {}) {
  const {
    debug = false,
    token: providedToken,
    chatId: providedChatId,
    messageThreadId: providedMessageThreadId,
    parse_mode = "",
    disable_notification = false,
  } = options;

  const token =
    providedToken ||
    (debug
      ? process.env.TELEGRAM_BOT_TOKEN_DEBUG
      : process.env.TELEGRAM_BOT_TOKEN);
  const chatId =
    providedChatId ||
    (debug ? process.env.TELEGRAM_CHAT_ID_DEBUG : process.env.TELEGRAM_CHAT_ID);
  const messageThreadId =
    providedMessageThreadId ||
    (debug
      ? process.env.TELEGRAM_TOPIC_ID_DEBUG
      : process.env.TELEGRAM_TOPIC_ID);

  if (!token || !chatId) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables"
    );
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text,
    parse_mode,
    disable_notification,
  };

  if (messageThreadId) {
    body.message_thread_id = Number(messageThreadId);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to send message to Telegram: ${errorBody}`);
    }
  } catch (error) {
    throw new Error(
      `Network error or failure while sending message: ${error.message}`
    );
  }
}

function mapGitHubToTelegram(username) {
  return githubToTelegramMap[username] || username;
}

export { sendTelegramMessage, mapGitHubToTelegram };
