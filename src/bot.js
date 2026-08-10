import { Bot, GrammyError, HttpError } from "grammy";
import { SYSTEM_PROMPT } from "./prompts.js";
import { splitForTelegram } from "./text.js";

function createBot(config, editor, logger = console) {
  const bot = new Bot(config.telegramToken, {
    client: config.telegramApiRoot ? { apiRoot: config.telegramApiRoot } : undefined,
  });

  async function alertAdmin(message) {
    if (!config.adminChatId) return;
    try { await bot.api.sendMessage(config.adminChatId, message, { parse_mode: "HTML", disable_web_page_preview: true }); }
    catch (error) { logger.error("Не удалось отправить уведомление администратору.", error); }
  }

  bot.on("message:text", async (ctx) => {
    const { id: userId } = ctx.from;
    const { chat, message_id: messageId, text } = ctx.msg;

    if (!config.allowedUserIds.has(userId)) {
      logger.warn(`Неавторизованный пользователь: user_id=${userId}, chat_id=${chat.id}`);
      await alertAdmin(`<tg-emoji emoji-id="5440660757194744323">‼️</tg-emoji> <b>Неавторизованный пользователь</b>\n\nUser ID: <code>${userId}</code>\nChat ID: <code>${chat.id}</code>`);
      if (config.deleteUnauthorizedMessages) {
        await ctx.deleteMessage().catch((error) => logger.warn("Не удалось удалить сообщение неавторизованного пользователя.", error));
      }
      return;
    }

    try {
      await ctx.replyWithChatAction("typing");
      const editedText = await editor.editText(SYSTEM_PROMPT, text);
      const parts = splitForTelegram(editedText);
      for (const [index, part] of parts.entries()) {
        await ctx.api.sendMessage(chat.id, part, index === 0 ? { reply_parameters: { message_id: messageId }, disable_web_page_preview: true, } : undefined);
      }
    } catch (error) {
      logger.error(`Не удалось обработать сообщение в чате ${chat.id}.`, error);
      await ctx.reply(`<tg-emoji emoji-id="5420323339723881652">⚠️</tg-emoji> <b>Не удалось обработать текст</b>\n\nПопробуйте ещё раз...`, {
        reply_parameters: { message_id: messageId },
        parse_mode: "HTML",
      }).catch((replyError) => logger.error("Не удалось отправить сообщение об ошибке.", replyError));
    }
  });

  bot.catch((error) => {
    const kind = error.error instanceof GrammyError ? "Ошибка API Telegram" : error.error instanceof HttpError ? "Сетевая ошибка Telegram" : "Непредвиденная ошибка";
    logger.error(`${kind} при обработке обновления ${error.ctx.update.update_id}.`, error.error);
  });

  return bot;
}

export { createBot };
