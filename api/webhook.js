import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("❌ Ошибка: BOT_TOKEN не задан в ENV");
  throw new Error("BOT_TOKEN is missing");
}

const bot = new TelegramBot(token);

let webhookSet = false;

// Отправка уведомления админу при старте
const adminChatId = process.env.ADMIN_CHAT_ID;
if (adminChatId) {
  (async () => {
    try {
      await bot.sendMessage(adminChatId, "🤖 Бот запущен и активен на Vercel!");
      console.log("✅ Уведомление админу отправлено");
    } catch (err) {
      console.error("Ошибка при отправке уведомления админу:", err);
    }
  })();
}

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      // Telegram шлёт update сюда
      bot.processUpdate(req.body);
      return res.status(200).send("ok");
    }

    // При GET — проверка / установка webhook
    if (!webhookSet && process.env.VERCEL_URL) {
      try {
        const info = await bot.getWebHookInfo();
        const currentUrl = info.url || "";
        const newUrl = `https://${process.env.VERCEL_URL}/api/webhook`;

        if (currentUrl !== newUrl) {
          await bot.setWebHook(newUrl);
          console.log(`Webhook установлен: ${newUrl}`);
        } else {
          console.log(`Webhook уже установлен: ${currentUrl}`);
        }
        webhookSet = true;
      } catch (err) {
        console.error("Ошибка проверки/установки webhook:", err);
      }
    }

    return res.status(200).send("Бот активен ✅");
  } catch (err) {
    console.error("Ошибка в handler webhook:", err);
    return res.status(500).send("Internal Server Error");
  }
}

// Обработка сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim().toLowerCase() || "";

  if (text === "/start") {
    await bot.sendMessage(chatId, "Привет! 🤖 Бот успешно работает на Vercel 🚀");
  } else {
    await bot.sendMessage(chatId, `Ты написал: ${msg.text}`);
  }
});
