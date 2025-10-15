const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

// Создаем бота в webhook-режиме, без polling
const bot = new TelegramBot(token, { webHook: true });

// Основная функция для Vercel
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const { body } = req;

      // Проверяем наличие сообщения
      if (body && body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text?.trim();

        if (text === '/start') {
          await bot.sendMessage(chatId, 'Привет, Егорик! 🤖 Бот работает!');
        } else {
          await bot.sendMessage(chatId, `Ты написал: ${text}`);
        }
      }

      // Telegram требует ответ 200
      res.status(200).json({ ok: true });
    } else {
      // GET-запрос (например, проверка состояния)
      res.status(200).json({ status: 'Bot webhook active ✅' });
    }
  } catch (error) {
    console.error('Ошибка обработки запроса:', error);
    // Telegramу всегда нужен ответ 200
    res.status(200).json({ ok: true });
  }
};
