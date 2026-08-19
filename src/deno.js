import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { loadWebhookConfig } from "./config.js";
import { createTextCorrector } from "./openai-client.js";

const config = loadWebhookConfig(Deno.env.toObject());
const correctText = createTextCorrector({ apiKey: config.openaiApiKey, baseUrl: config.openaiBaseUrl, model: config.openaiModel, promptCacheKey: config.openaiPromptCacheKey, maxOutputTokens: config.openaiMaxOutputTokens, timeoutMs: config.requestTimeoutMs });
const bot = createBot(config, correctText);
const handleUpdate = webhookCallback(bot, "std/http", { secretToken: config.webhookSecret, onTimeout: "throw", timeoutMilliseconds: config.webhookCallbackTimeoutMs });
await bot.api.setWebhook(config.webhookUrl, { secret_token: config.webhookSecret, allowed_updates: ["message"] });
Deno.serve((request) => {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") return new Response("ok");
  if (url.pathname !== config.webhookPath || request.method !== "POST") return new Response("Не найдено", { status: 404 });
  return handleUpdate(request);
});
