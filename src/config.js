import dotenv from "dotenv";

dotenv.config();

function required(name, value) {
  if (!value || !String(value).trim()) throw new Error(`Не задана обязательная переменная окружения: ${name}`);
  return String(value).trim();
}

function parseUserIds(value = "") {
  const ids = String(value).split(",").map((item) => item.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) throw new Error("ALLOWED_USER_IDS должен содержать список числовых идентификаторов пользователей Telegram, разделённых запятыми.");
  return new Set(ids.map(Number));
}

function parseTelegramChatId(value, varName) {
  if (value === undefined || value === "") return undefined;
  const parsed = String(value).trim();
  if (!/^-?\d+$/.test(parsed) || parsed === "0") throw new Error(`${varName} должен быть числовым идентификатором чата Telegram.`);
  return parsed;
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
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${varName} должен быть положительным целым числом.`);
  return parsed;
}

function parseHttpsUrl(value, varName, fallback) {
  const url = (value || fallback).trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(url)) throw new Error(`${varName} должен использовать HTTPS.`);
  return url;
}

function loadConfig(env = process.env) {
  const requestTimeoutMs = parsePositiveInt(env.REQUEST_TIMEOUT_MS, 30_000, "REQUEST_TIMEOUT_MS");
  return Object.freeze({
    telegramToken: required("TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN),
    telegramApiRoot: parseHttpsUrl(env.TELEGRAM_BOT_API_URL, "TELEGRAM_BOT_API_URL", "https://api.telegram.org"),
    openaiApiKey: required("OPENAI_API_KEY", env.OPENAI_API_KEY),
    openaiBaseUrl: parseHttpsUrl(env.OPENAI_BASE_URL, "OPENAI_BASE_URL", "https://api.openai.com/v1"),
    openaiModel: required("OPENAI_MODEL", env.OPENAI_MODEL),
    openaiPromptCacheKey: required("OPENAI_PROMPT_CACHE_KEY", env.OPENAI_PROMPT_CACHE_KEY),
    openaiMaxOutputTokens: parsePositiveInt(env.OPENAI_MAX_OUTPUT_TOKENS, 1000, "OPENAI_MAX_OUTPUT_TOKENS"),
    inputMaxLength: parsePositiveInt(env.INPUT_MAX_LENGTH, 12000, "INPUT_MAX_LENGTH"),
    requestTimeoutMs,
    maxConcurrentRequests: parsePositiveInt(env.MAX_CONCURRENT_REQUESTS, 3, "MAX_CONCURRENT_REQUESTS"),
    allowedUserIds: parseUserIds(env.ALLOWED_USER_IDS),
    adminChatId: parseTelegramChatId(env.ADMIN_CHAT_ID, "ADMIN_CHAT_ID"),
    telegramLogChatId: parseTelegramChatId(env.TELEGRAM_LOG_CHAT_ID, "TELEGRAM_LOG_CHAT_ID"),
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
  const webhookCallbackTimeoutMs = parsePositiveInt(env.WEBHOOK_CALLBACK_TIMEOUT_MS, Math.min(config.requestTimeoutMs + 5_000, 55_000), "WEBHOOK_CALLBACK_TIMEOUT_MS");
  if (webhookCallbackTimeoutMs < config.requestTimeoutMs) throw new Error("WEBHOOK_CALLBACK_TIMEOUT_MS не должен быть меньше REQUEST_TIMEOUT_MS.");
  return Object.freeze({ ...config, webhookUrl, webhookSecret, webhookPath: parsedUrl.pathname, webhookCallbackTimeoutMs });
}

export { loadConfig, loadWebhookConfig, parseBoolean, parsePositiveInt, parseTelegramChatId, parseUserIds };
