# IMOSTA Group — лендинг «Бухгалтерия для JDG (ИП)»

Лендинг для `jdg.imosta.pl`. Структура, Tailwind-токены и Telegram-пайплайн повторяют лендинг Sp. z o.o. (`imosta-landing`).

| Путь | Что это |
|---|---|
| `index.html` | RU-версия (`/`) |
| `eng/index.html` | EN-версия (`/eng`) |
| `ua/index.html` | UA-версия (`/ua`) |
| `thank-you.html` | Страница «Спасибо» (`/thank-you`, язык через `?lang=en\|ua`) |
| `api/send-lead.js` | Vercel Serverless Function: `POST /api/send-lead` → Telegram, метка `[Заявка JDG / ИП]` |
| `vercel.json` | cleanUrls, редиректы `/en`→`/eng`, `/uk`→`/ua`, заголовки безопасности |

## Деплой на Vercel

1. Импортировать репозиторий в Vercel (Framework Preset: **Other**, без build-команды).
2. Settings → Environment Variables (Production + Preview):
   - `TELEGRAM_BOT_TOKEN` — токен бота
   - `TELEGRAM_CHAT_ID` — ID чата/группы для заявок
3. Settings → Domains → добавить `jdg.imosta.pl`.
4. В DNS зоны `imosta.pl` добавить запись `CNAME jdg → cname.vercel-dns.com`.

## Payload формы

```json
{ "form_id": "hero|bottom", "source": "Hero Form", "name": "…", "contact": "+48… | @username | e-mail",
  "business_status": "active|planning", "lang": "ru|en|ua", "page": "…" }
```

Ответы: `200 ok`, `400 invalid_json`, `405`, `422 invalid_contact|invalid_name`, `500 not_configured`, `502 delivery_failed`.
