# Ebb Correct Bot

## Deno Deploy

The Deno Deploy entry point is `src/deno.js`. It receives Telegram updates over
a webhook, so it must not run alongside `npm start` or any other long-polling
instance using the same bot token.

Set all regular environment variables plus these Deno Deploy secrets:

| Variable | Required value |
| --- | --- |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS URL of this deployment, ending in `/telegram`, for example `https://your-project.deno.dev/telegram` |
| `TELEGRAM_WEBHOOK_SECRET` | A new random string of 1–256 characters: letters, digits, `_`, or `-` |

In Deno Deploy, create a project from this repository and choose `src/deno.js`
as the entry point. The application registers the webhook on startup. Deploy it
once, stop every existing local/server bot process, then send the bot a test
message. `GET /health` responds with `ok` for a basic availability check.

Закрытый Telegram-бот, который принимает текст от разрешённых пользователей и возвращает его отредактированную русскоязычную версию. Для генерации используется совместимый с OpenAI API.

## Запуск

1. Используйте Node.js 20 или новее.
2. Скопируйте `.env.example` в `.env` и заполните переменные. `ALLOWED_USER_IDS` — обязательный список числовых Telegram ID через запятую; пустой список безопасно запрещает доступ всем.
3. Установите зависимости: `npm install`.
4. Проверьте проект: `npm test`.
5. Запустите: `npm start`.

Для Linux-сервера готовый шаблон unit-файла находится в `deploy/ebb-correct-bot.service`. Укажите в нём реальные пути и пользователя, затем положите файл с переменными окружения в путь, заданный `EnvironmentFile`.

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | токен Telegram-бота |
| `TELEGRAM_BOT_API_URL` | необязательный адрес self-hosted Telegram Bot API |
| `OPENAI_API_KEY` | ключ API провайдера |
| `OPENAI_BASE_URL` | базовый URL OpenAI-совместимого API; по умолчанию — ProxyAPI, как в исходном проекте |
| `MODEL_ID` | идентификатор модели |
| `ALLOWED_USER_IDS` | разрешённые Telegram ID через запятую |
| `ADMIN_CHAT_ID` | необязательный чат для уведомлений о попытках доступа |
| `DELETE_UNAUTHORIZED_MESSAGES` | удалять сообщения неразрешённых пользователей (`true` по умолчанию) |

Бот не логирует тексты, ключи или полные ответы провайдера. Ответы Telegram отправляются без HTML/Markdown-разбора, поэтому содержимое текста не может сломать разметку сообщения.
