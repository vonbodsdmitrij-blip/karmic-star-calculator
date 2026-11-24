
const crypto = require("crypto");

const BOT_TOKEN = process.env.FULL_BOT_TOKEN;
const CHANNEL_ID = process.env.FULL_CHANNEL_ID;
const MINI_APP_URL =
  process.env.MINI_APP_URL ||
  "https://exquisite-pasca-238275.netlify.app";

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
    throw new Error(
      `Telegram ${method}: ${json.description || "API error"}`
    );
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

async function sendWelcome(chatId) {
  const welcomeText =
    "Добро пожаловать в «Полную Кармическую Звезду»!\n\n" +
    "Откройте калькулятор кнопкой ниже.";

  try {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: welcomeText,
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

    console.log("Welcome message with calculator button sent");
  } catch (error) {
    console.error("Web App button error:", error.message);

    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "Добро пожаловать в «Полную Кармическую Звезду»!\n\n" +
        "Калькулятор доступен по ссылке:\n" +
        MINI_APP_URL
    });

    console.log("Fallback welcome message sent");
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  if (event.httpMethod === "GET") {
    return response(200, {
      ok: true,
      message: "Full Telegram function is running"
    });
  }

  if (event.httpMethod !== "POST") {
    return response(405, {
      ok: false,
      error: "Method Not Allowed"
    });
  }

  if (!BOT_TOKEN) {
    console.error("FULL_BOT_TOKEN is not configured");

    return response(500, {
      ok: false,
      error: "Bot token is not configured"
    });
  }

  let body;

  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    console.error("Invalid request JSON:", error.message);

    return response(400, {
      ok: false,
      error: "Invalid JSON"
    });
  }

  // Проверка подписки из калькулятора
  if (body.action === "check_access") {
    try {
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
    } catch (error) {
      console.error("Membership check error:", error.message);

      return response(500, {
        ok: false,
        access: false,
        error: "Membership check failed"
      });
    }
  }

  // Входящие сообщения Telegram
  if (body.message) {
    const message = body.message;
    const chatId = message.chat && message.chat.id;
    const text = message.text || "";

    console.log("Telegram message received:", text);

    if (chatId && /^\/start(?:@\w+)?(?:\s|$)/.test(text)) {
      try {
        await sendWelcome(chatId);
      } catch (error) {
        console.error("Welcome delivery failed:", error.message);
      }
    }

    // Подтверждаем Telegram получение обновления
    return {
      statusCode: 200,
      headers,
      body: "OK"
    };
  }

  return response(200, {
    ok: true,
    message: "Update received"
  });
};
