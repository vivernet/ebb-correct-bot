import { createSafetyIdentifier } from "./safety-identifier.js";

/**
 * Извлекает текст сообщения об ошибке из значения произвольного типа.
 *
 * @param {unknown} error - Перехваченное значение ошибки.
 * @returns {string} Текст сообщения об ошибке.
 */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Создаёт функцию корректуры текста через OpenAI-совместимый Responses API.
 *
 * @param {object} [options]
 * @param {typeof OpenAI} [options.OpenAIClass] - Класс клиента OpenAI (для подмены в тестах). По умолчанию — OpenAI.
 * @param {string} [options.apiKey] - Ключ API.
 * @param {string} [options.baseUrl] - Базовый URL API.
 * @param {string} [options.model] - Идентификатор модели.
 * @param {string} [options.promptCacheKey] - Ключ prompt cache для запроса.
 * @param {number} [options.maxOutputTokens=1000] - Максимум выходных токенов.
 * @param {number} [options.timeoutMs=30000] - Таймаут запроса в миллисекундах.
 * @param {object} [options.client] - Готовый клиент OpenAI (для подмены в тестах).
 * @returns {(systemPrompt: string, text: string, safetyIdentifier: string) => Promise<{text: string, usage: (object|null), responseId: (string|null), model: string}>} Асинхронная функция корректуры текста.
 */
function createTextCorrector({ OpenAIClass = OpenAI, apiKey, baseUrl, model, promptCacheKey, maxOutputTokens = 1000, timeoutMs = 30_000, client } = {}) {
  const openai = client ?? new OpenAIClass({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries: 0 });

  return async function correctText(systemPrompt, text, safetyIdentifier) {
    try {
      const response = await openai.responses.create({
        model,
        store: false,
        prompt_cache_key: promptCacheKey,
        prompt_cache_options: {
          mode: "explicit",
          ttl: "30m",
        },
        reasoning: {
          effort: "none",
        },
        max_output_tokens: maxOutputTokens,
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: systemPrompt,
                prompt_cache_breakpoint: {
                  mode: "explicit",
                },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: text,
              },
            ],
          },
        ],
        safety_identifier: safetyIdentifier,
      });
      const output = response?.output_text;
      if (typeof output !== "string" || !output.trim()) {
        throw new Error("Сервис обработки текста вернул пустой ответ.");
      }
      return {
        text: output.trim(),
        usage: response.usage ?? null,
        responseId: response.id ?? null,
        model: response.model ?? model,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("пустой ответ")) {
        throw error;
      }
      throw new Error(`Не удалось обработать текст через OpenAI: ${getErrorMessage(error)}`, { cause: error });
    }
  };
}

const { default: OpenAI } = await import(globalThis.Deno ? "npm:openai" : "openai");

export { createSafetyIdentifier, createTextCorrector };
