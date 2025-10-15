require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Хранилище состояний пользователей
const userStates = {};

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  // Проверяем, находится ли пользователь в процессе создания объявления
  if (userStates[userId]) {
    handleAdCreation(msg);
    return;
  }

  // Обработка команд
  if (text === '/start') {
    bot.sendMessage(chatId, `Привет! 👋\n\nЯ бот для создания объявлений.\n\nИспользуй команду /create чтобы создать объявление.`);
  } else if (text === '/create' || text.toLowerCase().includes('создать объявление')) {
    startAdCreation(chatId, userId);
  } else {
    bot.sendMessage(chatId, 'Используй /create для создания объявления');
  }
});

function startAdCreation(chatId, userId) {
  userStates[userId] = {
    step: 'title',
    data: {}
  };
  
  bot.sendMessage(chatId, '📝 Создание объявления\n\nШаг 1/4: Введите заголовок объявления');
}

function handleAdCreation(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const state = userStates[userId];

  if (!state) return;

  switch (state.step) {
    case 'title':
      state.data.title = text;
      state.step = 'description';
      bot.sendMessage(chatId, '✏️ Шаг 2/4: Введите описание объявления');
      break;

    case 'description':
      state.data.description = text;
      state.step = 'price';
      bot.sendMessage(chatId, '💰 Шаг 3/4: Введите цену (или напишите "договорная")');
      break;

    case 'price':
      state.data.price = text;
      state.step = 'contact';
      bot.sendMessage(chatId, '📱 Шаг 4/4: Введите контактные данные (телефон или username)');
      break;

    case 'contact':
      state.data.contact = text;
      
      // Формируем итоговое объявление
      const ad = state.data;
      const adText = `
🎯 *НОВОЕ ОБЪЯВЛЕНИЕ*

📌 *Заголовок:* ${ad.title}

📝 *Описание:*
${ad.description}

💵 *Цена:* ${ad.price}

📞 *Контакт:* ${ad.contact}

_Объявление создано ${new Date().toLocaleString('ru-RU')}_
      `;
      
      bot.sendMessage(chatId, adText, { parse_mode: 'Markdown' });
      bot.sendMessage(chatId, '✅ Объявление успешно создано!\n\nИспользуй /create для создания нового объявления.');
      
      // Очищаем состояние пользователя
      delete userStates[userId];
      break;
  }
}

console.log('Бот запущен...');
