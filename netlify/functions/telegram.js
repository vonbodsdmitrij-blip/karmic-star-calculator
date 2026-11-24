
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      body: "Telegram bot is running"
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.MINI_APP_URL ||
    "https://exquisite-pasca-238275.netlify.app";

  if (!token) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN is missing");
    return {
      statusCode: 200,
      body: "Bot token is not configured"
    };
  }

  try {
    const update = JSON.parse(event.body || "{}");
    const message = update.message;

    if (!message || !message.text) {
      return {
        statusCode: 200,
        body: "OK"
      };
    }

    const command = message.text.trim();

    const isStart =
      /^\/start(?:@\w+)?(?:\s|$)/i.test(command);

    const isCalculate =
      /^\/calculate(?:@\w+)?(?:\s|$)/i.test(command);

    if (!isStart && !isCalculate) {
      return {
        statusCode: 200,
        body: "OK"
      };
    }

    console.log("Received command:", command);

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text:
            "✨ Добро пожаловать в калькулятор Кармической звезды!\n\n" +
            "Нажмите кнопку ниже, чтобы рассчитать свою звезду по дате рождения.",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "✨ Рассчитать кармическую звезду",
                web_app: {
                  url: appUrl
                }
              }
            ]]
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram API error:", result);
      return {
        statusCode: 200,
        body: "Telegram API error"
      };
    }

    console.log("Message sent successfully");

    return {
      statusCode: 200,
      body: "OK"
    };

  } catch (error) {
    console.error("Function error:", error);

    return {
      statusCode: 200,
      body: "Internal error"
    };
  }
};

