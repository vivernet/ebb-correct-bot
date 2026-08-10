import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, loadWebhookConfig, parseUserIds } from "../src/config.js";

test("разбирает корректную конфигурацию", () => {
  const config = loadConfig({
    TELEGRAM_BOT_TOKEN: "telegram-token", OPENAI_API_KEY: "api-key", MODEL_ID: "gpt-5.4-mini",
    ALLOWED_USER_IDS: "1, 22", DELETE_UNAUTHORIZED_MESSAGES: "false",
  });
  assert.deepEqual([...config.allowedUserIds], [1, 22]);
  assert.equal(config.openaiBaseUrl, "https://api.proxyapi.ru/openai/v1");
  assert.equal(config.deleteUnauthorizedMessages, false);
});

test("отклоняет некорректные идентификаторы пользователей", () => assert.throws(() => parseUserIds("1, user")));

test("отклоняет конфигурацию без обязательной настройки", () => {
  assert.throws(() => loadConfig({ OPENAI_API_KEY: "api-key", MODEL_ID: "gpt-5.4-mini" }), /TELEGRAM_BOT_TOKEN/);
});
