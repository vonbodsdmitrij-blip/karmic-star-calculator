
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
    return {
      statusCode: 500,
      body: "Bot token is not configured"
    };
  }

  try {
    const update = JSON.parse(event.body || "{}");
    const message = update.message;

    if (message && message.text &&
        (message.text === "/start" ||
         message.text === "/calculate")) {

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
                  web_app: { url: appUrl }
                }
              ]]
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error("Telegram API error");
      }
    }

    return {
      statusCode: 200,
      body: "OK"
    };

  } catch (error) {
    return {
      statusCode: 200,
      body: "OK"
    };
  }
};
