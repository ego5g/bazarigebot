// api/webhook.js
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('BOT_TOKEN not found!');
}

const bot = new TelegramBot(token);

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  
  try {
    if (req.method === 'POST') {
      const { body } = req;
      
      console.log('Received update:', JSON.stringify(body));
      
      if (body && body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text;
        
        console.log(`Message from ${chatId}: ${text}`);
        
        if (text === '/start') {
          await bot.sendMessage(chatId, 'Привет! 👋 Бот работает на Vercel!');
        } else {
          await bot.sendMessage(chatId, `Ты написал: ${text}`);
        }
      }
      
      return res.status(200).json({ ok: true });
    }
    
    // GET запрос
    return res.status(200).json({ status: 'Webhook is ready', time: new Date() });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: true, error: error.message });
  }
};
