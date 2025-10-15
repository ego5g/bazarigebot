import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN не задан");
}

const bot = new TelegramBot(token);
let webhookSet = false;

export default async function handler(req, res) {
  if (req.method === "POST") {
    bot.processUpdate(req.body);
    return res.status(200).send("ok");
  }

  if (!webhookSet && process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}/api/webhook`;
    await bot.setWebHook(url);
    webhookSet = true;
    console.log(`Webhook установлен: ${url}`);
  }

  res.status(200).send("Бот активен ✅");
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase() || "";

  if (text === "/start") {
    await bot.sendMessage(chatId, "Привет! Бот работает на Vercel 🚀");
  } else {
    await bot.sendMessage(chatId, `Ты написал: ${msg.text}`);
  }
});
