import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, parsePositiveInt, parseUserIds } from "../src/config.js";

test("разбирает корректную конфигурацию", () => {
  const config = loadConfig({
    TELEGRAM_BOT_TOKEN: "telegram-token",
    OPENAI_API_KEY: "api-key",
    OPENAI_MODEL: "gpt-5.6-luna",
    ALLOWED_USER_IDS: "1, 22",
    DELETE_UNAUTHORIZED_MESSAGES: "false",
  });
  assert.deepEqual([...config.allowedUserIds], [1, 22]);
  assert.equal(config.openaiBaseUrl, "https://api.openai.com/v1");
  assert.equal(config.deleteUnauthorizedMessages, false);
  assert.equal(config.openaiMaxOutputTokens, 1000);
});

test("отклоняет некорректные идентификаторы пользователей", () => assert.throws(() => parseUserIds("1, user")));

test("разбирает валидный OPENAI_MAX_OUTPUT_TOKENS", () => {
  const config = loadConfig({
    TELEGRAM_BOT_TOKEN: "telegram-token",
    OPENAI_API_KEY: "api-key",
    OPENAI_MODEL: "gpt-5.6-luna",
    ALLOWED_USER_IDS: "1",
    OPENAI_MAX_OUTPUT_TOKENS: "2048",
  });
  assert.equal(config.openaiMaxOutputTokens, 2048);
});

test("отклоняет конфигурацию без обязательной настройки", () => {
  assert.throws(() => loadConfig({ OPENAI_API_KEY: "api-key", OPENAI_MODEL: "gpt-5.6-luna" }), /TELEGRAM_BOT_TOKEN/);
});
