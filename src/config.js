import dotenv from "dotenv";

dotenv.config();

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Не задана обязательная переменная окружения: ${name}`);
  }
  return String(value).trim();
}

function parseUserIds(value = "") {
  const ids = String(value).split(",").map((item) => item.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error("ALLOWED_USER_IDS должен содержать список числовых идентификаторов пользователей Telegram, разделённых запятыми.");
  }
  return new Set(ids.map(Number));
}

function parseBoolean(value, fallback, varName = "значение") {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${varName} должен иметь значение true или false.`);
}

function parsePositiveInt(value, fallback, varName) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${varName} должен быть положительным целым числом.`);
  }
  return parsed;
}

function loadConfig(env = process.env) {
  const openaiBaseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!/^https:\/\//.test(openaiBaseUrl)) throw new Error("OPENAI_BASE_URL должен использовать HTTPS.");

  return Object.freeze({
    telegramToken: required("TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN),
    telegramApiRoot: env.TELEGRAM_BOT_API_URL?.trim() || "https://api.telegram.org",
    openaiApiKey: required("OPENAI_API_KEY", env.OPENAI_API_KEY),
    openaiBaseUrl,
    openaiModel: required("OPENAI_MODEL", env.OPENAI_MODEL),
    // Ключ обязателен: без него нельзя гарантировать корректную группировку prompt cache.
    openaiPromptCacheKey: required("OPENAI_PROMPT_CACHE_KEY", env.OPENAI_PROMPT_CACHE_KEY),
    openaiMaxOutputTokens: parsePositiveInt(env.OPENAI_MAX_OUTPUT_TOKENS, 1000, "OPENAI_MAX_OUTPUT_TOKENS"),
    inputMaxLength: parsePositiveInt(env.INPUT_MAX_LENGTH, 12000, "INPUT_MAX_LENGTH"),
    requestTimeoutMs: parsePositiveInt(env.REQUEST_TIMEOUT_MS, 30_000, "REQUEST_TIMEOUT_MS"),
    allowedUserIds: parseUserIds(env.ALLOWED_USER_IDS),
    adminChatId: env.ADMIN_CHAT_ID?.trim() || undefined,
    telegramLogChatId: env.TELEGRAM_LOG_CHAT_ID?.trim() || undefined,
    deleteUnauthorizedMessages: parseBoolean(env.DELETE_UNAUTHORIZED_MESSAGES, true, "DELETE_UNAUTHORIZED_MESSAGES"),
    webhookUrl: env.TELEGRAM_WEBHOOK_URL?.trim() || undefined,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
  });
}

function loadWebhookConfig(env = process.env) {
  const config = loadConfig(env);
  const webhookUrl = required("TELEGRAM_WEBHOOK_URL", config.webhookUrl);
  const webhookSecret = required("TELEGRAM_WEBHOOK_SECRET", config.webhookSecret);
  let parsedUrl;
  try { parsedUrl = new URL(webhookUrl); } catch { throw new Error("TELEGRAM_WEBHOOK_URL должен содержать корректный HTTPS-адрес."); }
  if (parsedUrl.protocol !== "https:") throw new Error("TELEGRAM_WEBHOOK_URL должен использовать HTTPS.");
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) throw new Error("TELEGRAM_WEBHOOK_SECRET должен содержать от 1 до 256 символов: букв A–Z и a–z, цифр, _ или -.");
  return Object.freeze({ ...config, webhookUrl, webhookSecret, webhookPath: parsedUrl.pathname });
}

export { loadConfig, loadWebhookConfig, parseBoolean, parsePositiveInt, parseUserIds };
