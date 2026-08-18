import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { OpenAiClient } from "./openai-client.js";

async function main() {
  const config = loadConfig();
  const editor = new OpenAiClient({
    apiKey: config.openaiApiKey,
    baseUrl: config.openaiBaseUrl,
    model: config.openaiModel,
    promptCacheKey: config.openaiPromptCacheKey,
    maxOutputTokens: config.openaiMaxOutputTokens,
  });
  const bot = createBot(config, editor);

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
  await bot.start({ drop_pending_updates: false });
}

main().catch((error) => {
  console.error("Не удалось запустить бота.", error);
  process.exitCode = 1;
});
