import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { createTextCorrector } from "./openai-client.js";

async function main() {
  const config = loadConfig();
  const correctText = createTextCorrector({ apiKey: config.openaiApiKey, baseUrl: config.openaiBaseUrl, model: config.openaiModel, promptCacheKey: config.openaiPromptCacheKey, maxOutputTokens: config.openaiMaxOutputTokens, timeoutMs: config.requestTimeoutMs });
  const bot = createBot(config, correctText);
  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
  await bot.start({ drop_pending_updates: false });
}
main().catch((error) => { console.error("Не удалось запустить бота.", error); process.exitCode = 1; });
