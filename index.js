const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// Обработчик для Vercel webhook
module.exports = async (req, res) => {
  try {
    // Только POST запросы
    if (req.method === 'POST') {
      const { body } = req;
      
      // Проверяем наличие сообщения
      if (body && body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text;
        
        // Обработка команды /start
        if (text === '/start') {
          await bot.sendMessage(chatId, 'Привет Егорик! Бот работает! 👋');
        } else {
          await bot.sendMessage(chatId, `Ты написал: ${text}`);
        }
      }
      
      // ОБЯЗАТЕЛЬНО отвечаем Telegram что все ОК
      res.status(200).json({ ok: true });
    } else {
      // GET запрос - просто статус
      res.status(200).json({ status: 'Bot is running' });
    }
  } catch (error) {
    console.error('Error:', error);
    // Даже при ошибке отвечаем 200, чтобы Telegram не думал что webhook сломан
    res.status(200).json({ ok: true });
  }
};
