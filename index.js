require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не найден. Добавь его в .env файл');
  process.exit(1);
}

// Создаём бота в режиме polling
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет, Егорик! Бот работает локально через polling!');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Игнорируем команду /start (чтобы не дублировать)
  if (text && text !== '/start') {
    bot.sendMessage(chatId, `Ты написал: ${text}`);
  }
});

console.log('✅ Бот запущен локально (polling mode)');
