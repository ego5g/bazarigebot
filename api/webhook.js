import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("❌ Ошибка: BOT_TOKEN не найден. Добавь его в Vercel → Settings → Environment Variables");
  throw new Error("BOT_TOKEN is missing");
}

// создаём бота без polling
const bot = new TelegramBot(token);
let webhookSet = false;

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      // Telegram шлёт сюда обновления
      bot.processUpdate(req.body);
      return res.status(200).send("ok");
    }

    // при GET-запросе проверяем/устанавливаем webhook
    if (!webhookSet && process.env.VERCEL_URL) {
      const url = `https://${process.env.VERCEL_URL}/api/webhook`;
      await bot.setWebHook(url);
      webhookSet = true;
      console.log(`✅ Webhook установлен: ${url}`);
    }

    res.status(200).send("Бот активен ✅");
  } catch (err) {
    console.error("Ошибка в webhook:", err);
    res.status(500).send("Internal Server Error");
  }
}

// обработка сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase() || "";

  if (text === "/start") {
    await bot.sendMessage(chatId, "Привет! 🤖 Бот успешно работает на Vercel 🚀");
  } else {
    await bot.sendMessage(chatId, `Ты написал: ${msg.text}`);
  }
});
