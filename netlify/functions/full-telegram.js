
const crypto = require("crypto");

const BOT_TOKEN = process.env.FULL_BOT_TOKEN;
const CHANNEL_ID = process.env.FULL_CHANNEL_ID;
const MINI_APP_URL = process.env.MINI_APP_URL;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function response(statusCode, data) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data)
  };
}

async function telegram(method, data) {
  const result = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  const json = await result.json();

  if (!json.ok) {
    throw new Error(json.description || "Telegram API error");
  }

  return json.result;
}

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) return null;

  params.delete("hash");

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);

  if (
    !authDate ||
    authDate > now + 60 ||
    now - authDate > 86400
  ) {
    return null;
  }

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

  const received = Buffer.from(hash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");

  if (
    received.length !== calculated.length ||
    !crypto.timingSafeEqual(received, calculated)
  ) {
    return null;
  }

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

async function checkMembership(userId) {
  if (!CHANNEL_ID) {
    throw new Error("FULL_CHANNEL_ID is not configured");
  }

  const member = await telegram("getChatMember", {
    chat_id: CHANNEL_ID,
    user_id: userId
  });

  return (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member" ||
    (member.status === "restricted" && member.is_member === true)
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  if (!BOT_TOKEN) {
    return response(500, {
      ok: false,
      error: "FULL_BOT_TOKEN is not configured"
    });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    // Запрос из калькулятора: проверка подписки
    if (body.action === "check_access") {
      const user = verifyInitData(body.initData);

      if (!user || !user.id) {
        return response(401, {
          ok: false,
          access: false,
          error: "Invalid Telegram authorization"
        });
      }

      const access = await checkMembership(user.id);

      return response(200, {
        ok: true,
        access,
        user: {
          id: user.id,
          first_name: user.first_name || ""
        }
      });
    }

    // Входящие сообщения от Telegram
    if (event.httpMethod === "POST" && body.message) {
      const message = body.message;
      const chatId = message.chat && message.chat.id;
      const text = message.text || "";

      if (chatId && text.startsWith("/start")) {
        if (!MINI_APP_URL) {
          throw new Error("MINI_APP_URL is not configured");
        }

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "Добро пожаловать в «Полную Кармическую Звезду»!\n\n" +
            "Откройте калькулятор кнопкой ниже.",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "Открыть калькулятор",
                web_app: {
                  url: MINI_APP_URL
                }
              }
            ]]
          }
        });
      }

      return {
        statusCode: 200,
        body: "OK"
      };
    }

    return response(200, {
      ok: true,
      message: "Full Telegram function is running"
    });

  } catch (error) {
    console.error("Full Telegram function error:", error);

    return response(500, {
      ok: false,
      error: "Server error"
    });
  }
};
