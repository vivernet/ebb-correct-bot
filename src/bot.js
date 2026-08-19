import { Bot, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { SYSTEM_PROMPT } from "./prompts.js";
import { splitForTelegram } from "./text.js";

function errorDetails(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.cause ? ` | причина: ${errorDetails(error.cause)}` : ""}`;
  return String(error);
}

function createBot(config, correctText, logger = console) {
  const bot = new Bot(config.telegramToken, { client: { apiRoot: config.telegramApiRoot } });

  async function telegramLog(level, message, error) {
    logger[level]?.(message, error);
    if (!config.telegramLogChatId) return;
    const suffix = error ? `\n<pre>${escapeHtml(errorDetails(error)).slice(0, 3500)}</pre>` : "";
    await bot.api.sendMessage(config.telegramLogChatId, `<b>[${level.toUpperCase()}]</b> ${escapeHtml(message)}${suffix}`, { parse_mode: "HTML", disable_web_page_preview: true }).catch((sendError) => logger.error("Не удалось отправить лог в Telegram.", sendError));
  }

  async function alertAdmin(message) {
    if (!config.adminChatId) return;
    await bot.api.sendMessage(config.adminChatId, message, { parse_mode: "HTML", disable_web_page_preview: true }).catch((error) => telegramLog("error", "Не удалось отправить уведомление администратору", error));
  }

  bot.on("message:text", async (ctx) => {
    const { id: userId } = ctx.from;
    const { chat, message_id: messageId, text } = ctx.msg;
    if (!config.allowedUserIds.has(userId)) {
      await telegramLog("warn", `Неизвестный пользователь: user_id=${userId}, chat_id=${chat.id}`);
      await alertAdmin(`<b>Неизвестный пользователь</b>\nUser ID: <code>${userId}</code>\nChat ID: <code>${chat.id}</code>`);
      if (config.deleteUnauthorizedMessages) await ctx.deleteMessage().catch((error) => telegramLog("warn", "Не удалось удалить сообщение неизвестного пользователя", error));
      return;
    }
    if (text.length > config.inputMaxLength) {
      await ctx.reply(`Текст слишком длинный. Максимальный размер: ${config.inputMaxLength} символов.`, { reply_parameters: { message_id: messageId } });
      return;
    }
    try {
      await ctx.replyWithChatAction("typing");
      const editedText = await correctText(SYSTEM_PROMPT, text);
      for (const [index, part] of splitForTelegram(editedText).entries()) {
        const options = index === 0 ? { reply_parameters: { message_id: messageId }, disable_web_page_preview: true, ...(part.length <= 256 ? { reply_markup: new InlineKeyboard().add({ text: "📋 Копировать", copy_text: { text: part } }) } : {}) } : undefined;
        await ctx.api.sendMessage(chat.id, part, options);
      }
    } catch (error) {
      await telegramLog("error", `Не удалось обработать сообщение в чате ${chat.id}`, error);
      await ctx.reply("‼️ Не удалось обработать текст. Попробуйте ещё раз.", { reply_parameters: { message_id: messageId } }).catch((replyError) => telegramLog("error", "Не удалось отправить сообщение об ошибке", replyError));
    }
  });

  bot.catch((error) => telegramLog("error", `Ошибка обновления ${error.ctx.update.update_id}: ${error.error instanceof GrammyError ? "Telegram API" : error.error instanceof HttpError ? "сеть Telegram" : "непредвиденная ошибка"}`, error.error));
  return bot;
}

function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
export { createBot, errorDetails };
