import { sendTelegramMessage } from "./telegram";

// Сохраняем оригинальные методы
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

/**
 * Форматирует аргументы в одну строку.
 *
 * @param {Array} args - Массив аргументов.
 * @returns {string} - Форматированная строка.
 */
function formatMessage(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

// Переопределяем console.log
console.log = function (...args) {
  const message = formatMessage(args);
  originalConsoleLog.apply(console, args);
  // Асинхронно отправляем сообщение в Telegram (не блокируя основной поток)
  sendTelegramMessage(`[LOG] ${message}`).catch((err) => {
    originalConsoleError("Error sending log message to Telegram:", err);
  });
};

// Переопределяем console.error
console.error = function (...args) {
  const message = formatMessage(args);
  originalConsoleError.apply(console, args);
  sendTelegramMessage(`[ERROR] ${message}`).catch((err) => {
    originalConsoleError("Error sending error message to Telegram:", err);
  });
};

export default console;
