import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { loadWebhookConfig } from "./config.js";
import { OpenAiClient } from "./openai-client.js";

const config = loadWebhookConfig();
const editor = new OpenAiClient({
  apiKey: config.openaiApiKey,
  baseUrl: config.openaiBaseUrl,
  model: config.openaiModel,
});
const bot = createBot(config, editor);
const handleUpdate = webhookCallback(bot, "std/http", {
  secretToken: config.webhookSecret,
  onTimeout: "return",
  timeoutMilliseconds: 25_000,
});

await bot.api.setWebhook(config.webhookUrl, {
  secret_token: config.webhookSecret,
  allowed_updates: ["message"],
});

Deno.serve((request) => {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");
  if (url.pathname !== config.webhookPath || request.method !== "POST") {
    return new Response("Не найдено", { status: 404 });
  }
  return handleUpdate(request);
});
