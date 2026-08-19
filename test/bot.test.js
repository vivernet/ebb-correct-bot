import test from "node:test";
import assert from "node:assert/strict";
import { userErrorMessage } from "../src/bot.js";

test("сообщает о таймауте без технических деталей", () => {
  const error = new Error("Не удалось обработать текст через OpenAI", { cause: { name: "APIConnectionTimeoutError" } });
  assert.match(userErrorMessage(error), /слишком долго/);
});

test("сообщает о перегрузке провайдера", () => {
  const error = new Error("Не удалось обработать текст через OpenAI", { cause: { status: 429 } });
  assert.match(userErrorMessage(error), /перегружен/);
});

test("не раскрывает детали неизвестной ошибки", () => {
  assert.equal(userErrorMessage(new Error("secret provider detail")), "‼️ Не удалось обработать текст. Попробуйте ещё раз.");
});
