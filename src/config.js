import dotenv from "dotenv";

dotenv.config();

function required(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Не задана обязательная переменная окружения: ${name}`);
  }
  return value.trim();
}

function parseUserIds(value = "") {
  const ids = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error("ALLOWED_USER_IDS должен содержать список числовых идентификаторов пользователей Telegram, разделённых запятыми.");
  }
  return new Set(ids.map(Number));
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("DELETE_UNAUTHORIZED_MESSAGES должен иметь значение true или false.");
}

function loadConfig(env = process.env) {
  const baseUrl = (env.OPENAI_BASE_URL || "https://api.proxyapi.ru/openai/v1").replace(/\/+$/, "");
  if (!/^https:\/\//.test(baseUrl)) {
    throw new Error("OPENAI_BASE_URL должен использовать HTTPS.");
  }

  return Object.freeze({
    telegramToken: required("TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN),
    telegramApiRoot: env.TELEGRAM_BOT_API_URL?.trim() || undefined,
    openaiApiKey: required("OPENAI_API_KEY", env.OPENAI_API_KEY),
    openaiBaseUrl: baseUrl,
    model: required("MODEL_ID", env.MODEL_ID),
    allowedUserIds: parseUserIds(env.ALLOWED_USER_IDS),
    adminChatId: env.ADMIN_CHAT_ID?.trim() || undefined,
    deleteUnauthorizedMessages: parseBoolean(env.DELETE_UNAUTHORIZED_MESSAGES, true),
  });
}

export { loadConfig, parseBoolean, parseUserIds };
