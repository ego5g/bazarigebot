import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("❌ BOT_TOKEN отсутствует в переменных окружения!");
}

// Создаём бота без polling
const bot = new TelegramBot(token, { webHook: { port: 80 } });

// Обработчик всех апдейтов Telegram
export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const update = req.body;
      const chatId = update.message?.chat?.id;
      const text = update.message?.text;

      // Если это команда /start
      if (text === "/start") {
        await bot.sendMessage(chatId, "👋 Привет! Бот успешно работает на Vercel 🚀");
      } else if (text) {
        await bot.sendMessage(chatId, `Ты написал: ${text}`);
      }

      return res.status(200).send("ok");
    } catch (err) {
      console.error("Ошибка обработки апдейта:", err);
      return res.status(500).send("error");
    }
  }

  // GET-запрос — установка webhook
  if (req.method === "GET") {
    try {
      const webhookUrl = `https://${process.
