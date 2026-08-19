function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function createTextCorrector({ OpenAIClass = OpenAI, apiKey, baseUrl, model, promptCacheKey, maxOutputTokens = 1000, timeoutMs = 30_000, client } = {}) {
  const openai = client ?? new OpenAIClass({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries: 0 });

  return async function correctText(systemPrompt, text) {
    try {
      const response = await openai.responses.create({
        model,
        max_output_tokens: maxOutputTokens,
        store: false,
        prompt_cache_key: promptCacheKey,
        instructions: systemPrompt,
        input: text,
      });
      const output = response?.output_text;
      if (typeof output !== "string" || !output.trim()) throw new Error("Сервис обработки текста вернул пустой ответ.");
      return {
        text: output.trim(),
        usage: response.usage ?? null,
        responseId: response.id ?? null,
        model: response.model ?? model,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("пустой ответ")) throw error;
      throw new Error(`Не удалось обработать текст через OpenAI: ${getErrorMessage(error)}`, { cause: error });
    }
  };
}

const { default: OpenAI } = await import(globalThis.Deno ? "npm:openai" : "openai");

export { createTextCorrector };
