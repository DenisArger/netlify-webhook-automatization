import { sendTelegramMessage } from "./telegram";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function formatMessage(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return "[Unserializable Object]";
        }
      }
      return String(arg);
    })
    .join(" ");
}

function logToTelegram(type, args) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${type.toUpperCase()}] ${timestamp}\n${formatMessage(
    args
  )}`;

  const maxLength = 4000;
  const message =
    formattedMessage.length > maxLength
      ? formattedMessage.slice(0, maxLength - 3) + "..."
      : formattedMessage;

  sendTelegramMessage(message).catch((err) => {
    originalConsoleError("Error sending log message to Telegram:", err);
  });
}

console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  logToTelegram("log", args);
};

console.error = function (...args) {
  originalConsoleError.apply(console, args);
  logToTelegram("error", args);
};

console.warn = function (...args) {
  originalConsoleWarn.apply(console, args);
  logToTelegram("warn", args);
};

export default console;
