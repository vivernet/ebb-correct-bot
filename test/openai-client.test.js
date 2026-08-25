import test from "node:test";
import assert from "node:assert/strict";
import { createSafetyIdentifier, createTextCorrector } from "../src/openai-client.js";

test("создаёт стабильный анонимный safety identifier из Chat ID", async () => {
  const safetyIdentifier = await createSafetyIdentifier("-1001234567890");
  assert.equal(safetyIdentifier, "user_FQquYcsAYR_TnUULMhrbFzuEcrrS8c1oZX29ppuwrwA");
  assert.equal(safetyIdentifier.length, 48);
});

test("отправляет инструкцию и возвращает текст", async () => {
  let request;
  const correctText = createTextCorrector({ apiKey: "secret", baseUrl: "https://example.test/v1", model: "test-model", promptCacheKey: "cache-key-1", maxOutputTokens: 777, client: { responses: { create: async (payload) => { request = payload; return { output_text: "  Исправленный текст  " }; } } } });
  const result = await correctText("Редактируй", "Черновик", "user_123456");
  assert.equal(result.text, "Исправленный текст");
  assert.deepEqual(request.input, [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: "Редактируй",
          prompt_cache_breakpoint: { mode: "explicit" },
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: "Черновик" }],
    },
  ]);
  assert.equal(request.prompt_cache_key, "cache-key-1");
  assert.deepEqual(request.prompt_cache_options, { mode: "explicit", ttl: "30m" });
  assert.equal(request.max_output_tokens, 777);
  assert.equal(request.safety_identifier, "user_123456");
});

test("сохраняет исходную причину ошибки", async () => {
  const originalError = new Error("provider failed");
  const correctText = createTextCorrector({ apiKey: "secret", baseUrl: "https://example.test/v1", model: "test-model", promptCacheKey: "cache-key-1", client: { responses: { create: async () => { throw originalError; } } } });
  await assert.rejects(() => correctText("prompt", "text"), (error) => error instanceof Error && error.cause === originalError);
});
