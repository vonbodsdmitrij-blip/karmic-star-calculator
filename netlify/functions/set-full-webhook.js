
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const secret = process.env.SETUP_SECRET;
  const receivedSecret = event.headers["x-setup-secret"];

  if (!secret || receivedSecret !== secret) {
    return {
      statusCode: 403,
      body: "Access denied"
    };
  }

  const token = process.env.FULL_BOT_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      body: "FULL_BOT_TOKEN is missing"
    };
  }

  const webhookUrl =
    "https://exquisite-pasca-238275.netlify.app/.netlify/functions/full-telegram";

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"]
        })
      }
    );

    const result = await response.json();

    return {
      statusCode: response.ok ? 200 : 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Webhook setup failed"
      })
    };
  }
};
