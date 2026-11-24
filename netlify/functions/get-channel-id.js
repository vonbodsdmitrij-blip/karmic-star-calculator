exports.handler = async () => {
  try {
    const token = process.env.FULL_BOT_TOKEN;

    if (!token) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: "FULL_BOT_TOKEN не найден в настройках Netlify"
        })
      };
    }

    const telegram = async (method, data = {}) => {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        }
      );

      return await response.json();
    };

    const webhook = await telegram("getWebhookInfo");

    if (!webhook.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          ok: false,
          step: "getWebhookInfo",
          message: webhook.description
        })
      };
    }

    if (webhook.result.url) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          webhook_set: true,
          message: "Вебхук уже установлен. Настройки не изменялись."
        })
      };
    }

    const updates = await telegram("getUpdates", {
      timeout: 0,
      allowed_updates: ["channel_post"]
    });

    if (!updates.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          ok: false,
          step: "getUpdates",
          message: updates.description
        })
      };
    }

    const channels = updates.result
      .filter(update => update.channel_post?.chat)
      .map(update => ({
        id: update.channel_post.chat.id,
        title: update.channel_post.chat.title || "",
        type: update.channel_post.chat.type
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        webhook_set: false,
        channels
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: error.message
      })
    };
  }
};
