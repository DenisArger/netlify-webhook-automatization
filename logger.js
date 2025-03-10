import { sendTelegramMessage } from "./telegram";

// Оригинальные методы консоли
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

/**
 * Форматирует аргументы в читаемый вид.
 *
 * @param {Array} args - Массив аргументов.
 * @returns {string} - Форматированная строка.
 */
function formatMessage(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2); // Форматируем JSON с отступами
        } catch (e) {
          return "[Unserializable Object]";
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * Логирование с отправкой в Telegram.
 *
 * @param {"log" | "error" | "warn"} type - Тип лога.
 * @param {Array} args - Аргументы.
 */
function logToTelegram(type, args) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${type.toUpperCase()}] ${timestamp}\n${formatMessage(
    args
  )}`;

  // Обрезаем сообщение, если оно слишком длинное для Telegram
  const maxLength = 4000;
  const message =
    formattedMessage.length > maxLength
      ? formattedMessage.slice(0, maxLength - 3) + "..."
      : formattedMessage;

  sendTelegramMessage(message).catch((err) => {
    originalConsoleError("Error sending log message to Telegram:", err);
  });
}

// Переопределяем console.log
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  logToTelegram("log", args);
};

// Переопределяем console.error
console.error = function (...args) {
  originalConsoleError.apply(console, args);
  logToTelegram("error", args);
};

// Переопределяем console.warn
console.warn = function (...args) {
  originalConsoleWarn.apply(console, args);
  logToTelegram("warn", args);
};

export default console;
