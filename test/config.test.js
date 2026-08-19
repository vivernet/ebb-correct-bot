import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, loadWebhookConfig, parsePositiveInt, parseTelegramChatId, parseUserIds } from "../src/config.js";

const base = { TELEGRAM_BOT_TOKEN: "telegram-token", OPENAI_API_KEY: "api-key", OPENAI_MODEL: "test-model", OPENAI_PROMPT_CACHE_KEY: "cache-key", ALLOWED_USER_IDS: "1" };

test("разбирает корректную конфигурацию", () => {
  const config = loadConfig({ ...base, DELETE_UNAUTHORIZED_MESSAGES: "false" });
  assert.deepEqual([...config.allowedUserIds], [1]);
  assert.equal(config.openaiPromptCacheKey, "cache-key");
  assert.equal(config.inputMaxLength, 12000);
  assert.equal(config.requestTimeoutMs, 30000);
  assert.equal(config.maxConcurrentRequests, 3);
  assert.equal(config.deleteUnauthorizedMessages, false);
});

test("отклоняет некорректные идентификаторы пользователей", () => assert.throws(() => parseUserIds("1, user")));
test("проверяет chat ID для технических уведомлений", () => {
  assert.equal(parseTelegramChatId("-100123", "ADMIN_CHAT_ID"), "-100123");
  assert.throws(() => parseTelegramChatId("channel", "ADMIN_CHAT_ID"), /ADMIN_CHAT_ID/);
});
test("разбирает числовые лимиты", () => {
  const config = loadConfig({ ...base, OPENAI_MAX_OUTPUT_TOKENS: "2048", INPUT_MAX_LENGTH: "500", REQUEST_TIMEOUT_MS: "7000", MAX_CONCURRENT_REQUESTS: "2" });
  assert.equal(config.openaiMaxOutputTokens, 2048);
  assert.equal(config.inputMaxLength, 500);
  assert.equal(config.requestTimeoutMs, 7000);
  assert.equal(config.maxConcurrentRequests, 2);
  assert.throws(() => parsePositiveInt("0", 1, "TEST"));
});
test("отклоняет конфигурацию без обязательных настроек", () => {
  assert.throws(() => loadConfig({ ...base, OPENAI_PROMPT_CACHE_KEY: "" }), /OPENAI_PROMPT_CACHE_KEY/);
  assert.throws(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: "" }), /TELEGRAM_BOT_TOKEN/);
});
test("проверяет совместимые таймауты вебхука", () => {
  const env = { ...base, TELEGRAM_WEBHOOK_URL: "https://example.test/telegram", TELEGRAM_WEBHOOK_SECRET: "secret", REQUEST_TIMEOUT_MS: "10000", WEBHOOK_CALLBACK_TIMEOUT_MS: "15000" };
  assert.equal(loadWebhookConfig(env).webhookCallbackTimeoutMs, 15000);
  assert.throws(() => loadWebhookConfig({ ...env, WEBHOOK_CALLBACK_TIMEOUT_MS: "9000" }), /WEBHOOK_CALLBACK_TIMEOUT_MS/);
});
