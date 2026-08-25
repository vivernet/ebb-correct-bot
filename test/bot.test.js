import test from "node:test";
import assert from "node:assert/strict";
import { formatUsage, userErrorMessage } from "../src/bot.js";

test("форматирует расход токенов с чтением и записью кэша без лишнего префикса", () => {
  assert.equal(
    formatUsage({
      input_tokens: 1200,
      output_tokens: 50,
      total_tokens: 1250,
      input_tokens_details: { cached_tokens: 800, cache_write_tokens: 400 },
    }),
    "input=1200, output=50, total=1250, cached=800, cache_write=400",
  );
});

test("не добавляет отсутствующие метрики кэша", () => {
  assert.equal(formatUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }), "input=10, output=5, total=15");
  assert.equal(formatUsage(null), "данные не предоставлены провайдером");
});

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
