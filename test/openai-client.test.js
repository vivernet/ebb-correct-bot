import test from "node:test";
import assert from "node:assert/strict";
import { OpenAiClient } from "../src/openai-client.js";

test("отправляет инструкцию редактора и возвращает сгенерированный текст", async () => {
  let request;
  const client = new OpenAiClient({
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "test-model",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: "  Исправленный текст  " } }],
      }), { status: 200 });
    },
  });

  const result = await client.editText("Редактируй", "Черновик");
  assert.equal(result, "Исправленный текст");
  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.options.body).messages, [
    { role: "system", content: "Редактируй" },
    { role: "user", content: "Черновик" },
  ]);
});

test("отклоняет некорректный ответ провайдера", async () => {
  const client = new OpenAiClient({
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "test-model",
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(() => client.editText("prompt", "text"), /пустой ответ/);
});
