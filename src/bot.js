import { Bot, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { SYSTEM_PROMPT } from "./prompts.js";
import { splitForTelegram } from "./text.js";

function errorDetails(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.cause ? ` | причина: ${errorDetails(error.cause)}` : ""}`;
  return String(error);
}

function formatUsage(usage) {
  if (!usage) return "токены: данные не предоставлены провайдером";
  const input = usage.input_tokens ?? usage.prompt_tokens ?? "?";
  const output = usage.output_tokens ?? usage.completion_tokens ?? "?";
  const total = usage.total_tokens ?? "?";
  const cached = usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens;
  return `токены: input=${input}, output=${output}, total=${total}${cached === undefined ? "" : `, cached=${cached}`}`;
}

function createBot(config, correctText, logger = console) {
  const bot = new Bot(config.telegramToken, { client: { apiRoot: config.telegramApiRoot } });

  async function telegramLog(level, message, details = {}) {
    const line = `${message}${details.error ? ` | ${errorDetails(details.error)}` : ""}`;
    logger[level]?.(line);
    if (!config.telegramLogChatId) return;
    const fields = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => `${key}: ${value}`).join("\n");
    const body = `<b>[${level.toUpperCase()}]</b> ${escapeHtml(message)}${fields ? `\n<pre>${escapeHtml(fields).slice(0, 3500)}</pre>` : ""}`;
    await bot.api.sendMessage(config.telegramLogChatId, body, { parse_mode: "HTML", disable_web_page_preview: true }).catch((sendError) => logger.error("Не удалось отправить лог в Telegram.", sendError));
  }

  async function alertAdmin(message) {
    if (!config.adminChatId) return;
    await bot.api.sendMessage(config.adminChatId, message, { parse_mode: "HTML", disable_web_page_preview: true }).catch((error) => telegramLog("error", "Не удалось отправить уведомление администратору", { error }));
  }

  bot.on("message:text", async (ctx) => {
    const { id: userId, username, first_name: firstName } = ctx.from;
    const { chat, message_id: messageId, text } = ctx.msg;
    const baseDetails = { update_id: ctx.update.update_id, user_id: userId, username: username ? `@${username}` : undefined, user_name: firstName, chat_id: chat.id, message_id: messageId, input_chars: text.length };
    if (!config.allowedUserIds.has(userId)) {
      await telegramLog("warn", "Неизвестный пользователь", baseDetails);
      await alertAdmin(`<b>Неизвестный пользователь</b>\nUser ID: <code>${userId}</code>\nChat ID: <code>${chat.id}</code>`);
      if (config.deleteUnauthorizedMessages) await ctx.deleteMessage().catch((error) => telegramLog("warn", "Не удалось удалить сообщение неизвестного пользователя", { ...baseDetails, error }));
      return;
    }
    if (text.length > config.inputMaxLength) {
      await telegramLog("warn", "Отклонён слишком длинный текст", baseDetails);
      await ctx.reply(`Текст слишком длинный. Максимальный размер: ${config.inputMaxLength} символов.`, { reply_parameters: { message_id: messageId } });
      return;
    }
    const startedAt = Date.now();
    await telegramLog("info", "Начата обработка текста", baseDetails);
    try {
      await ctx.replyWithChatAction("typing");
      const result = await correctText(SYSTEM_PROMPT, text);
      const editedText = result.text;
      for (const [index, part] of splitForTelegram(editedText).entries()) {
        const options = index === 0 ? { reply_parameters: { message_id: messageId }, disable_web_page_preview: true, ...(part.length <= 256 ? { reply_markup: new InlineKeyboard().add({ text: "📋 Копировать", copy_text: { text: part } }) } : {}) } : undefined;
        await ctx.api.sendMessage(chat.id, part, options);
      }
      await telegramLog("info", "Текст обработан", { ...baseDetails, duration_ms: Date.now() - startedAt, output_chars: editedText.length, response_id: result.responseId, model: result.model, usage: formatUsage(result.usage) });
    } catch (error) {
      await telegramLog("error", "Не удалось обработать текст", { ...baseDetails, duration_ms: Date.now() - startedAt, error });
      await ctx.reply("‼️ Не удалось обработать текст. Попробуйте ещё раз.", { reply_parameters: { message_id: messageId } }).catch((replyError) => telegramLog("error", "Не удалось отправить сообщение об ошибке", { ...baseDetails, error: replyError }));
    }
  });

  bot.catch((error) => telegramLog("error", `Ошибка обновления ${error.ctx.update.update_id}: ${error.error instanceof GrammyError ? "Telegram API" : error.error instanceof HttpError ? "сеть Telegram" : "непредвиденная ошибка"}`, { update_id: error.ctx.update.update_id, error: error.error }));
  return bot;
}

function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
export { createBot, errorDetails, formatUsage };
