import test from "node:test";
import assert from "node:assert/strict";
import { OpenAiClient } from "../src/openai-client.js";

test("отправляет инструкцию редактора и возвращает сгенерированный текст", async () => {
  let request;
  const client = new OpenAiClient({
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "test-model",
    promptCacheKey: "cache-key-1",
    maxOutputTokens: 777,
  });

  const createResponse = {
    output_text: "  Исправленный текст  ",
  };

  client.client.responses.create = async (payload) => {
    request = payload;
    return createResponse;
  };

  const result = await client.editText("Редактируй", "Черновик");
  assert.equal(result, "Исправленный текст");
  assert.equal(request.model, "test-model");
  assert.equal(request.max_output_tokens, 777);
  assert.equal(request.store, false);
  assert.equal(request.prompt_cache_key, "cache-key-1");
  assert.deepEqual(request.prompt_cache_options, { mode: "explicit" });
  assert.deepEqual(request.input, [
    {
      role: "developer",
      content: [
        { type: "input_text", text: "Редактируй" },
        {
          type: "input_text",
          text: "",
          prompt_cache_breakpoint: { mode: "explicit" },
        },
      ],
    },
    { role: "user", content: [{ type: "input_text", text: "Черновик" }] },
  ]);
});

test("отклоняет некорректный ответ провайдера", async () => {
  const client = new OpenAiClient({
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "test-model",
  });

  client.client.responses.create = async () => ({});

  await assert.rejects(() => client.editText("prompt", "text"), /пустой ответ/);
});
