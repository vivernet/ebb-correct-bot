class OpenAiClient {
  constructor({ apiKey, baseUrl, model, fetchImpl = globalThis.fetch }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.fetch = fetchImpl;
  }

  async editText(systemPrompt, text) {
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error("Не удалось подключиться к сервису обработки текста.");
    }

    if (!response.ok) {
      throw new Error(`Сервис обработки текста вернул HTTP ${response.status}.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Сервис обработки текста вернул некорректный ответ.");
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Сервис обработки текста вернул пустой ответ.");
    }
    return content.trim();
  }
}

export { OpenAiClient };
