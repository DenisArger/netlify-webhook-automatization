import { githubToTelegramMap } from "./config.js";

async function sendTelegramMessage(text, debug = false) {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  let messageThreadId = process.env.TELEGRAM_TOPIC_ID;

  if (!debug) {
    token = process.env.TELEGRAM_BOT_TOKEN;
    chatId = process.env.TELEGRAM_CHAT_ID;
    messageThreadId = process.env.TELEGRAM_TOPIC_ID;
  } else {
    token = process.env.TELEGRAM_BOT_TOKEN_DEBUG;
    chatId = process.env.TELEGRAM_CHAT_ID_DEBUG;
    messageThreadId = process.env.TELEGRAM_TOPIC_ID_DEBUG;
  }

  if (!token || !chatId) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables"
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
