import OpenAI from "npm:openai";

class OpenAiClient {
  constructor({ apiKey, baseUrl, model, promptCacheKey, maxOutputTokens = 1000 }) {
    this.model = model;
    this.promptCacheKey = promptCacheKey;
    this.maxOutputTokens = maxOutputTokens;
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 30_000,
    });
  }

  async editText(systemPrompt, text) {
    let response;
    try {
      response = await this.client.responses.create({
        model: this.model,
        temperature: 0.2,
        max_output_tokens: this.maxOutputTokens,
        store: false,
        prompt_cache_key: this.promptCacheKey,
        prompt_cache_options: {
          mode: "explicit",
        },
        input: [
          {
            role: "developer",
            type: "message",
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
            type: "message",
            content: [
                {
                  type: "input_text",
                  text
                }
            ]
          },
        ],
      });
    } catch (error) {
      // Пробрасываем подробности ошибки, чтобы было видно реальную причину (сетевые/авторизация/несовместимость SDK).
      throw new Error(`Не удалось подключиться к сервису обработки текста: ${error?.message || error}`);
    }

    const content = response?.output_text;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Сервис обработки текста вернул пустой ответ.");
    }
    return content.trim();
  }
}

export { OpenAiClient };
