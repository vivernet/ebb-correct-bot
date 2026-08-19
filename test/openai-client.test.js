import test from "node:test";
import assert from "node:assert/strict";
import { createTextCorrector } from "../src/openai-client.js";

test("отправляет инструкцию и возвращает текст", async () => {
  let request;
  const correctText = createTextCorrector({ apiKey: "secret", baseUrl: "https://example.test/v1", model: "test-model", promptCacheKey: "cache-key-1", maxOutputTokens: 777, client: { responses: { create: async (payload) => { request = payload; return { output_text: "  Исправленный текст  " }; } } } });
  const result = await correctText("Редактируй", "Черновик");
  assert.equal(result.text, "Исправленный текст");
  assert.equal(request.instructions, "Редактируй");
  assert.equal(request.input, "Черновик");
  assert.equal(request.prompt_cache_key, "cache-key-1");
});

test("сохраняет исходную причину ошибки", async () => {
  const originalError = new Error("provider failed");
  const correctText = createTextCorrector({ apiKey: "secret", baseUrl: "https://example.test/v1", model: "test-model", promptCacheKey: "cache-key-1", client: { responses: { create: async () => { throw originalError; } } } });
  await assert.rejects(() => correctText("prompt", "text"), (error) => error instanceof Error && error.cause === originalError);
});
