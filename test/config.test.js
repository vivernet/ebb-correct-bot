import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, parsePositiveInt, parseUserIds } from "../src/config.js";

const base = { TELEGRAM_BOT_TOKEN: "telegram-token", OPENAI_API_KEY: "api-key", OPENAI_MODEL: "test-model", OPENAI_PROMPT_CACHE_KEY: "cache-key", ALLOWED_USER_IDS: "1" };

test("разбирает корректную конфигурацию", () => {
  const config = loadConfig({ ...base, DELETE_UNAUTHORIZED_MESSAGES: "false" });
  assert.deepEqual([...config.allowedUserIds], [1]);
  assert.equal(config.openaiPromptCacheKey, "cache-key");
  assert.equal(config.inputMaxLength, 12000);
  assert.equal(config.requestTimeoutMs, 30000);
  assert.equal(config.deleteUnauthorizedMessages, false);
});
test("отклоняет некорректные идентификаторы пользователей", () => assert.throws(() => parseUserIds("1, user")));
test("разбирает числовые лимиты", () => { const config = loadConfig({ ...base, OPENAI_MAX_OUTPUT_TOKENS: "2048", INPUT_MAX_LENGTH: "500", REQUEST_TIMEOUT_MS: "7000" }); assert.equal(config.openaiMaxOutputTokens, 2048); assert.equal(config.inputMaxLength, 500); assert.equal(config.requestTimeoutMs, 7000); });
test("отклоняет конфигурацию без обязательных настроек", () => { assert.throws(() => loadConfig({ ...base, OPENAI_PROMPT_CACHE_KEY: "" }), /OPENAI_PROMPT_CACHE_KEY/); assert.throws(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: "" }), /TELEGRAM_BOT_TOKEN/); });
