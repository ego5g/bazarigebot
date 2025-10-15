import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN не задан в переменных окружения");
}

// создаём экземпляр бота без polling
const bot = new TelegramBot(token);

let webhookSet = false;

export default async function handler(req, res) {
  if (req.method === "POST") {
    // Telegram шлёт обновления сюда
    try {
      bot.processUpdate(req.body);
    } catch (err) {
      console.error("Ошибка обработки update:", err);
    }
    return res.status(200).send("ok");
  }

  // GET — можем установить webhook, если ещё не установлен
  if (!webhookSet && process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}/api/webhook`;
    try {
      await bot.setWebHook(url);
      console.log("Webhook установлен:", url);
      webhookSet = true;
    } catch (err) {
      console.error("Ошибка установки webhook:", err);
    }
  }

  res.status(200).send("Бот на Vercel запущен");
}

// Пример обработки сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text === "/start") {
    await bot.sendMessage(chatId, "Привет! Бот работает через webhook на Vercel.");
  } else {
    await bot.sendMessage(chatId, `Ты написал: ${text}`);
  }
});
