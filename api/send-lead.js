// Vercel Serverless Function: POST /api/send-lead
// Принимает заявку с лендинга JDG и отправляет её в Telegram.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const LANDING_TYPE = 'JDG';
const LEAD_TAG = '[Заявка JDG / ИП]';
const MAX_BODY_BYTES = 10 * 1024;

const LABELS = {
  form_id: { hero: 'Форма на первом экране', bottom: 'Форма внизу страницы' },
  business_status: {
    active: 'Действующее JDG',
    planning: 'Планирует открыть',
  },
  lang: { ru: 'RU', en: 'EN', ua: 'UA' },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(value, max = 200) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

// Та же логика, что и на клиенте: номер (PL или международный), Telegram @username или e-mail
function parseContact(raw) {
  const v = clean(raw, 254);
  if (v.indexOf('@') > 0) {
    return { valid: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), type: 'email', value: v.toLowerCase() };
  }
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v)) {
    return { valid: true, type: 'telegram', value: '@' + v.replace(/^@/, '') };
  }
  let d = v.replace(/\D/g, '');
  if (!v.startsWith('+') && d.length === 9) d = '48' + d;
  if (d.startsWith('48')) return { valid: d.length === 11, type: 'phone', value: '+' + d };
  return { valid: d.length >= 8 && d.length <= 15, type: 'phone', value: '+' + d };
}

function parseBody(req) {
  const body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return null;
    try { return JSON.parse(body); } catch { return null; }
  }
  return null;
}

function buildMessage(lead, contact) {
  const label = (group, key) => LABELS[group][key] || key;
  const lines = [`<b>${escapeHtml(LEAD_TAG)} 🆕 Новая заявка</b>`, ''];

  if (lead.name) lines.push(`<b>Имя:</b> ${escapeHtml(lead.name)}`);
  if (contact.type === 'telegram') {
    const handle = contact.value.slice(1);
    lines.push(`<b>Telegram:</b> <a href="https://t.me/${handle}">${escapeHtml(contact.value)}</a>`);
  } else if (contact.type === 'email') {
    lines.push(`<b>E-mail:</b> ${escapeHtml(contact.value)}`);
  } else {
    lines.push(`<b>Телефон:</b> ${escapeHtml(contact.value)}`);
  }
  if (lead.business_status) lines.push(`<b>Статус JDG:</b> ${escapeHtml(label('business_status', lead.business_status))}`);
  lines.push(`<b>Источник:</b> ${escapeHtml(label('form_id', lead.form_id))}${lead.source ? ` (${escapeHtml(lead.source)})` : ''}`);
  if (lead.lang) lines.push(`<b>Язык страницы:</b> ${escapeHtml(label('lang', lead.lang))}`);

  lines.push('');
  if (lead.page) lines.push(`<b>Страница:</b> ${escapeHtml(lead.page)}`);
  lines.push(`<b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })} (Варшава)`);
  return lines.join('\n');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('send-lead: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const body = parseBody(req);
  if (!body) return res.status(400).json({ ok: false, error: 'invalid_json' });

  const contact = parseContact(body.contact);
  if (!contact.valid) return res.status(422).json({ ok: false, error: 'invalid_contact' });

  const lead = {
    name: clean(body.name, 100),
    form_id: clean(body.form_id, 20) || 'unknown',
    source: clean(body.source, 40),
    business_status: clean(body.business_status, 30),
    lang: clean(body.lang, 5),
    page: clean(body.page, 300),
  };
  if ((lead.form_id === 'hero' || lead.form_id === 'bottom') && lead.name.length < 2) {
    return res.status(422).json({ ok: false, error: 'invalid_name' });
  }

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: buildMessage(lead, contact),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!tg.ok) {
      console.error('send-lead: Telegram API error', tg.status, await tg.text());
      return res.status(502).json({ ok: false, error: 'delivery_failed' });
    }
  } catch (err) {
    console.error('send-lead: Telegram request failed', err);
    return res.status(502).json({ ok: false, error: 'delivery_failed' });
  }

  return res.status(200).json({ ok: true, landing_type: LANDING_TYPE });
}

module.exports = handler;
