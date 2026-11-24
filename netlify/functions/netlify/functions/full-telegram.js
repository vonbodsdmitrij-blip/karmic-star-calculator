
const crypto = require("crypto");

const BOT_TOKEN = process.env.FULL_BOT_TOKEN;
const CHANNEL_ID = process.env.FULL_CHANNEL_ID;
const MINI_APP_URL = process.env.MINI_APP_URL;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

async function telegram(method, data = {}) {
  const result = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  return result.json();
}

async function isChannelMember(userId) {
  if (!CHANNEL_ID || !BOT_TOKEN) {
    throw new Error("Missing bot or channel configuration");
  }

  const result = await telegram("getChatMember", {
    chat_id: CHANNEL_ID,
    user_id: userId
  });

  if (!result.ok) return false;

  const member = result.result;

  return (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member" ||
    (member.status === "restricted" && member.is_member === true)
  );
}

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) return null;

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");

  if (
    received.length !== calculated.length ||
    !crypto.timingSafeEqual(received, calculated)
  ) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));

  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return null;
  }

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  console.log("FULL TELEGRAM WEBHOOK RECEIVED", event.httpMethod);

  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
  }

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      body: "Full Karmic Star bot is running"
    };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { ok: false, error: "Method not allowed" });
  }

  if (!BOT_TOKEN) {
    return response(500, { ok: false, error: "Bot token is not configured" });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { ok: false, error: "Invalid JSON" });
  }

  // Проверка подписки по запросу из Telegram Mini App
  if (body.action === "check_access") {
    const user = verifyTelegramInitData(body.initData);

    if (!user || !user.id) {
      return response(401, {
        ok: false,
        access: false,
        error: "Invalid Telegram authorization"
      });
    }

    try {
      const access = await isChannelMember(user.id);

      return response(200, {
        ok: true,
        access
      });
    } catch {
      return response(503, {
        ok: false,
        access: false,
        error: "Access check unavailable"
      });
    }
  }

  // Обработка сообщений Telegram
  const message = body.message;

  if (!message || !message.chat || !message.from) {
    return response(200, { ok: true });
  }

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || "";

  if (text.startsWith("/start")) {
    try {
      const access = await isChannelMember(userId);

      if (!access) {
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "🔒 Полная Кармическая Звезда доступна участникам закрытого канала «Полная звезда».\n\nОформите подписку на канал, затем вернитесь сюда и нажмите /start."
        });

        return response(200, { ok: true });
      }

      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "✨ Добро пожаловать в «Полную Кармическую Звезду»!\n\nВаша подписка подтверждена. Откройте калькулятор, чтобы построить свою звезду.",
        reply_markup: {
          inline_keyboard: [[
            {
              text: "⭐ Открыть калькулятор",
              web_app: { url: MINI_APP_URL }
            }
          ]]
        }
      });
    } catch {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "Сейчас не удалось проверить подписку. Попробуйте немного позже."
      });
    }
  }

  return response(200, { ok: true });
};
