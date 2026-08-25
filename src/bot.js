import { Bot, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { createSafetyIdentifier } from "./openai-client.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { splitForTelegram } from "./text.js";

/**
 * Рекурсивно форматирует ошибку и цепочку её причин (`cause`) в читаемую строку.
 *
 * @param {unknown} error - Ошибка или произвольное значение.
 * @returns {string} Текстовое представление ошибки, включая причины.
 */
function errorDetails(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.cause ? ` | причина: ${errorDetails(error.cause)}` : ""}`;
  }
  return String(error);
}

/**
 * Форматирует объект usage ответа модели в читаемую строку с числом токенов.
 *
 * @param {object|null|undefined} usage - Объект usage из ответа OpenAI (Responses или Chat Completions API).
 * @returns {string} Строка вида "input=..., output=..., total=..., cached=..., cache_write=...".
 */
function formatUsage(usage) {
  if (!usage) {
    return "данные не предоставлены провайдером";
  }
  const input = usage.input_tokens ?? usage.prompt_tokens ?? "?";
  const output = usage.output_tokens ?? usage.completion_tokens ?? "?";
  const total = usage.total_tokens ?? "?";
  const cached = usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens;
  const cacheWrite = usage.input_tokens_details?.cache_write_tokens ?? usage.prompt_tokens_details?.cache_write_tokens;
  return `input=${input}, output=${output}, total=${total}${cached === undefined ? "" : `, cached=${cached}`}${cacheWrite === undefined ? "" : `, cache_write=${cacheWrite}`}`;
}

/**
 * Преобразует внутреннюю ошибку обработки текста в безопасное сообщение для пользователя,
 * не раскрывающее технические детали провайдера.
 *
 * @param {unknown} error - Ошибка, брошенная функцией корректуры текста.
 * @returns {string} Текст сообщения для пользователя.
 */
function userErrorMessage(error) {
  const cause = error instanceof Error ? error.cause : undefined;
  const status = cause?.status ?? cause?.statusCode;
  if (cause?.name === "APIConnectionTimeoutError" || cause?.name === "AbortError" || status === 408 || status === 504) {
    return "⌛ Сервис обработки отвечает слишком долго. Попробуйте ещё раз через минуту.";
  }
  if (status === 429) {
    return "⏳ Сервис обработки временно перегружен. Попробуйте ещё раз через минуту.";
  }
  if (status >= 500) {
    return "⚠️ Сервис обработки временно недоступен. Попробуйте ещё раз позже.";
  }
  return "‼️ Не удалось обработать текст. Попробуйте ещё раз.";
}

/**
 * Экранирует служебные символы HTML для безопасной вставки текста в сообщения Telegram с parse_mode "HTML".
 *
 * @param {unknown} value - Произвольное значение, приводимое к строке.
 * @returns {string} Строка с экранированными символами &, < и >.
 */
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Создаёт и настраивает экземпляр Telegram-бота: проверку доступа, ограничение параллелизма,
 * вызов корректуры текста, разбиение длинных ответов и логирование.
 *
 * @param {object} config - Конфигурация бота (см. loadConfig/loadWebhookConfig из config.js).
 * @param {(systemPrompt: string, text: string, safetyIdentifier: string) => Promise<{text: string, usage: (object|null), responseId: (string|null), model: string}>} correctText - Функция корректуры текста.
 * @param {Console} [logger=console] - Логгер для вывода в консоль (подменяется в тестах).
 * @returns {Bot} Настроенный, но ещё не запущенный экземпляр grammY-бота.
 */
function createBot(config, correctText, logger = console) {
  const bot = new Bot(config.telegramToken, { client: { apiRoot: config.telegramApiRoot } });
  const activeChats = new Set();
  let activeRequests = 0;

  /**
   * Логирует событие в консоль и, если настроен `telegramLogChatId`, отправляет его в служебный чат Telegram.
   * Отправка в Telegram не блокирует вызывающий код: ошибки отправки лога перехватываются и логируются отдельно.
   *
   * @param {"info"|"warn"|"error"} level - Уровень логирования.
   * @param {string} message - Краткое сообщение события.
   * @param {object} [details={}] - Дополнительные поля события (могут включать ошибку под ключом `error`).
   * @returns {void}
   */
  function telegramLog(level, message, details = {}) {
    const line = `${message}${details.error ? ` | ${errorDetails(details.error)}` : ""}`;
    logger[level]?.(line);
    if (!config.telegramLogChatId) {
      return;
    }
    const fields = Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${value instanceof Error ? errorDetails(value) : value}`)
      .join("\n");
    const body = `<b>[${level.toUpperCase()}]</b> ${escapeHtml(message)}${fields ? `\n<pre>${escapeHtml(fields).slice(0, 3500)}</pre>` : ""}`;
    bot.api
      .sendMessage(config.telegramLogChatId, body, { parse_mode: "HTML", disable_web_page_preview: true })
      .catch((sendError) => logger.error("Не удалось отправить лог в Telegram.", sendError));
  }

  /**
   * Отправляет уведомление администратору в `adminChatId`, если он настроен.
   *
   * @param {string} message - Текст уведомления (HTML).
   * @returns {Promise<void>}
   */
  async function alertAdmin(message) {
    if (!config.adminChatId) {
      return;
    }
    await bot.api
      .sendMessage(config.adminChatId, message, { parse_mode: "HTML", disable_web_page_preview: true })
      .catch((error) => telegramLog("error", "Не удалось отправить уведомление администратору", { error }));
  }

  bot.on("message:text", async (ctx) => {
    const { id: userId, username, first_name: firstName } = ctx.from;
    const { chat, message_id: messageId, text } = ctx.msg;
    const baseDetails = {
      update_id: ctx.update.update_id,
      user_id: userId,
      username: username ? `@${username}` : undefined,
      user_name: firstName,
      chat_id: chat.id,
      message_id: messageId,
      input_chars: text.length,
    };

    if (!config.allowedUserIds.has(userId)) {
      telegramLog("warn", "Неизвестный пользователь", baseDetails);
      await alertAdmin(`<b>Неизвестный пользователь</b>\nUser ID: <code>${userId}</code>\nChat ID: <code>${chat.id}</code>`);
      if (config.deleteUnauthorizedMessages) {
        await ctx.deleteMessage().catch((error) => telegramLog("warn", "Не удалось удалить сообщение неизвестного пользователя", { ...baseDetails, error }));
      }
      return;
    }
    if (text.length > config.inputMaxLength) {
      telegramLog("warn", "Отклонён слишком длинный текст", baseDetails);
      await ctx.reply(`Текст слишком длинный. Максимальный размер: ${config.inputMaxLength} символов.`, { reply_parameters: { message_id: messageId } });
      return;
    }
    if (activeChats.has(chat.id)) {
      telegramLog("info", "Отклонён параллельный запрос в том же чате", baseDetails);
      await ctx.reply("⏳ Предыдущее сообщение ещё обрабатывается. Пожалуйста, дождитесь ответа.", { reply_parameters: { message_id: messageId } });
      return;
    }
    if (activeRequests >= config.maxConcurrentRequests) {
      telegramLog("warn", "Достигнут лимит одновременных запросов", { ...baseDetails, active_requests: activeRequests });
      await ctx.reply("⏳ Бот сейчас обрабатывает другие сообщения. Попробуйте ещё раз через минуту.", { reply_parameters: { message_id: messageId } });
      return;
    }

    const startedAt = Date.now();
    activeChats.add(chat.id);
    activeRequests += 1;
    telegramLog("info", "Начата обработка текста", { ...baseDetails, active_requests: activeRequests });
    try {
      await ctx.replyWithChatAction("typing");
      const safetyIdentifier = await createSafetyIdentifier(chat.id);
      const result = await correctText(SYSTEM_PROMPT, text, safetyIdentifier);
      const editedText = result.text;
      for (const [index, part] of splitForTelegram(editedText).entries()) {
        const options =
          index === 0
            ? {
                reply_parameters: { message_id: messageId },
                disable_web_page_preview: true,
                ...(part.length <= 256 ? { reply_markup: new InlineKeyboard().add({ text: "📋 Копировать", copy_text: { text: part } }) } : {}),
              }
            : undefined;
        await ctx.api.sendMessage(chat.id, part, options);
      }
      telegramLog("info", "Текст обработан", {
        ...baseDetails,
        duration_ms: Date.now() - startedAt,
        output_chars: editedText.length,
        response_id: result.responseId,
        model: result.model,
        safety_identifier: safetyIdentifier,
        usage: formatUsage(result.usage),
      });
    } catch (error) {
      telegramLog("error", "Не удалось обработать текст", { ...baseDetails, duration_ms: Date.now() - startedAt, error });
      await ctx.reply(userErrorMessage(error), { reply_parameters: { message_id: messageId } }).catch((replyError) => telegramLog("error", "Не удалось отправить сообщение об ошибке", { ...baseDetails, error: replyError }));
    } finally {
      activeChats.delete(chat.id);
      activeRequests -= 1;
    }
  });

  bot.catch((error) =>
    telegramLog("error", `Ошибка обновления ${error.ctx.update.update_id}: ${error.error instanceof GrammyError ? "Telegram API" : error.error instanceof HttpError ? "сеть Telegram" : "непредвиденная ошибка"}`, {
      update_id: error.ctx.update.update_id,
      error: error.error,
    }),
  );

  return bot;
}

export { createBot, errorDetails, formatUsage, userErrorMessage };
