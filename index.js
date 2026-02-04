import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

const app = express();
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const update = req.body;

  try {
    await bot.processUpdate(update);
  } catch (e) {
    console.error("processUpdate error", e);
  }

  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Бот жив и работает через webhook");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("🚀 Server started on port", PORT);
});
