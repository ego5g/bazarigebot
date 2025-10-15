import TelegramBot from "node-telegram-bot-api";

// токен берём из переменных окружения
const token = process.env.BOT_TOKEN;

// создаём бота (без polling)
const bot = new TelegramBot(token);

// чтобы избежать повторных вызовов при деплое
let webhookSet = false;

export default async function handler(req, res) {
  if (req.method === "POST") {
    // это запрос от Telegram
    bot.processUpdate(req.body);
    return res.status(200).send("ok");
  }

  // при первом GET запросе выставляем webhook
  if (!webhookSet && process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}/api/webhook`;
    await bot.setWebHook(url);
    webhookSet = true;
    console.log(`Webhook установлен: ${url}`);
  }

  res.status(200).send("Бот работает на Vercel ✅");
}

// обработка сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase() || "";

  if (text === "/start") {
    await bot.sendMessage(chatId, "Привет 👋 Бот успешно работает на Vercel!");
  } else {
    await bot.sendMessage(chatId, `Ты написал: ${msg.text}`);
  }
});
