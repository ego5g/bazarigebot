require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// Хранилище состояний пользователей (в продакшене используйте базу данных)
const userStates = {};

// Функция для создания главного меню
function getMainMenu() {
  return {
    keyboard: [
      ['📝 Создать объявление'],
      ['📋 Мои объявления', '🔍 Поиск'],
      ['ℹ️ Помощь']
    ],
    resize_keyboard: true
  };
}

// Функция для обработки сообщений
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  // Проверяем, находится ли пользователь в процессе создания объявления
  if (userStates[userId]) {
    await handleAdCreation(msg);
    return;
  }

  // Обработка команд и кнопок
  if (text === '/start') {
    await bot.sendMessage(chatId, 
      `Привет, ${msg.from.first_name}! 👋\n\n` +
      `Я бот для создания объявлений на Bazarige.\n\n` +
      `Выбери действие из меню ниже:`, 
      { reply_markup: getMainMenu() }
    );
  } else if (text === '/create' || text === '📝 Создать объявление') {
    await startAdCreation(chatId, userId);
  } else if (text === '📋 Мои объявления') {
    await bot.sendMessage(chatId, 'Раздел "Мои объявления" в разработке 🚧', { reply_markup: getMainMenu() });
  } else if (text === '🔍 Поиск') {
    await bot.sendMessage(chatId, 'Раздел "Поиск" в разработке 🚧', { reply_markup: getMainMenu() });
  } else if (text === 'ℹ️ Помощь') {
    await bot.sendMessage(chatId, 
      `*Помощь по боту:*\n\n` +
      `📝 Создать объявление - пошаговое создание объявления\n` +
      `📋 Мои объявления - просмотр ваших объявлений\n` +
      `🔍 Поиск - поиск объявлений\n\n` +
      `По вопросам: @support`, 
      { parse_mode: 'Markdown', reply_markup: getMainMenu() }
    );
  } else {
    await bot.sendMessage(chatId, 'Выберите действие из меню 👇', { reply_markup: getMainMenu() });
  }
}

async function startAdCreation(chatId, userId) {
  userStates[userId] = {
    step: 'title',
    data: {}
  };
  
  await bot.sendMessage(chatId, 
    '📝 *Создание объявления*\n\n' +
    '*Шаг 1/4:* Введите заголовок объявления\n\n' +
    '_Для отмены отправьте /cancel_',
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['❌ Отмена']],
        resize_keyboard: true
      }
    }
  );
}

async function handleAdCreation(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const state = userStates[userId];

  if (!state) return;

  // Отмена создания
  if (text === '/cancel' || text === '❌ Отмена') {
    delete userStates[userId];
    await bot.sendMessage(chatId, '❌ Создание объявления отменено', { reply_markup: getMainMenu() });
    return;
  }

  switch (state.step) {
    case 'title':
      if (text.length < 5) {
        await bot.sendMessage(chatId, '⚠️ Заголовок слишком короткий. Минимум 5 символов.');
        return;
      }
      state.data.title = text;
      state.step = 'description';
      await bot.sendMessage(chatId, '✏️ *Шаг 2/4:* Введите описание объявления', { parse_mode: 'Markdown' });
      break;

    case 'description':
      if (text.length < 10) {
        await bot.sendMessage(chatId, '⚠️ Описание слишком короткое. Минимум 10 символов.');
        return;
      }
      state.data.description = text;
      state.step = 'price';
      await bot.sendMessage(chatId, '💰 *Шаг 3/4:* Введите цену\n\n_Например: 5000 или "Договорная"_', { parse_mode: 'Markdown' });
      break;

    case 'price':
      state.data.price = text;
      state.step = 'contact';
      await bot.sendMessage(chatId, '📱 *Шаг 4/4:* Введите контактные данные\n\n_Например: +995 555 123456 или @username_', { parse_mode: 'Markdown' });
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

_Создано: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}_
      `;
      
      await bot.sendMessage(chatId, adText, { parse_mode: 'Markdown' });
      await bot.sendMessage(chatId, 
        '✅ Объявление успешно создано!\n\nВыберите действие:', 
        { reply_markup: getMainMenu() }
      );
      
      // Очищаем состояние пользователя
      delete userStates[userId];
      break;
  }
}

// Для локальной разработки
if (process.env.NODE_ENV !== 'production') {
  bot.on('message', handleMessage);
  bot.startPolling();
  console.log('Бот запущен в режиме polling...');
}

// Экспорт для Vercel (webhook)
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { body } = req;
      if (body.message) {
        await handleMessage(body.message);
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(200).json({ status: 'Bot is running' });
  }
};
