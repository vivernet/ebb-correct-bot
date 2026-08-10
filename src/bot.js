import { Bot, GrammyError, HttpError } from "grammy";
import { SYSTEM_PROMPT } from "./prompts.js";
import { splitForTelegram } from "./text.js";

function createBot(config, editor, logger = console) {
  const bot = new Bot(config.telegramToken, {
    client: config.telegramApiRoot ? { apiRoot: config.telegramApiRoot } : undefined,
  });

  async function alertAdmin(message) {
    if (!config.adminChatId) return;
    try {
      await bot.api.sendMessage(config.adminChatId, message);
    } catch (error) {
      logger.error("Не удалось отправить уведомление администратору.", error);
    }
  }

  bot.on("message:text", async (ctx) => {
    const { id: userId } = ctx.from;
    const { chat, message_id: messageId, text } = ctx.msg;

    if (!config.allowedUserIds.has(userId)) {
      logger.warn(`Попытка несанкционированного доступа: пользователь=${userId}, чат=${chat.id}`);
      await alertAdmin(`Попытка несанкционированного доступа\nID пользователя: ${userId}\nID чата: ${chat.id}`);
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
        await ctx.api.sendMessage(chat.id, part, index === 0 ? { reply_parameters: { message_id: messageId } } : undefined);
      }
    } catch (error) {
      logger.error(`Не удалось обработать сообщение в чате ${chat.id}.`, error);
      await ctx.reply("Не удалось обработать текст. Попробуйте ещё раз позже.", {
        reply_parameters: { message_id: messageId },
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
