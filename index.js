require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.8259422856:AAFfqhBOK_h9GGGtk5LQZBR2lpJE1LpJubI;
const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  bot.sendMessage(chatId, `Привет Егорик! Ты написал: ${text}`);
});
