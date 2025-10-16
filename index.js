require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// === НАСТРОЙКИ ===
const token = process.env.BOT_TOKEN || 'ТОКЕН_ТВОЕГО_БОТА';
const CHAT_ID = '@easymarket_ge';
const MOD_CHAT_ID = '178060329';
const bot = new TelegramBot(token, { polling: true });

// === КАТЕГОРИИ / THREAD ID ===
const categories = [['👩 Женское'], ['📱 Электроника'], ['🚗 Авто']];
const CATEGORY_TARGETS = {
  '👩 Женское': { chatId: CHAT_ID, threadId: 17 },
  '📱 Электроника': { chatId: CHAT_ID, threadId: 9 },
  '🚗 Авто': { chatId: CHAT_ID, threadId: 8 },
};

// === ХРАНИЛИЩЕ ===
const ads = {}; // активные объявления пользователей
const pendingAds = {}; // объявления на модерации

// === КЛАВИАТУРЫ ===
function backButton() {
  return { reply_markup: { keyboard: [[{ text: '🔙 Назад' }]], resize_keyboard: true } };
}
function categoryKeyboard() {
  return { reply_markup: { keyboard: categories, resize_keyboard: true, one_time_keyboard: true } };
}

// === /start ===
bot.onText(/\/start|\/create/i, (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  ads[userId] = { step: 'category', prevStep: null, photos: [] };
  bot.sendMessage(chatId, 'Выберите категорию:', categoryKeyboard());
});

// === ОБРАБОТКА ТЕКСТА ===
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text?.trim();
    if (!ads[userId] || msg.photo) return;
    const ad = ads[userId];

    if (text === '🔙 Назад') {
      if (!ad.prevStep) return bot.sendMessage(chatId, 'Вы на первом шаге.');
      ad.step = ad.prevStep;
      switch (ad.step) {
        case 'category': return bot.sendMessage(chatId, 'Выберите категорию:', categoryKeyboard());
        case 'title': return bot.sendMessage(chatId, 'Введите заголовок:', backButton());
        case 'description': return bot.sendMessage(chatId, 'Введите описание:', backButton());
        case 'price': return bot.sendMessage(chatId, 'Введите цену (или "договорная"):', backButton());
        case 'photos': return bot.sendMessage(chatId, 'Отправьте фото заново (1–5 шт):', backButton());
      }
    }

    // --- ВЫБОР КАТЕГОРИИ ---
    if (ad.step === 'category') {
      if (!categories.flat().includes(text)) return;
      ad.category = text;
      ad.prevStep = 'category';
      ad.step = 'photos';
      return bot.sendMessage(chatId, 'Отправьте от 1 до 5 фото одним сообщением:', backButton());
    }

    // --- ВВОД ЗАГОЛОВКА ---
    if (ad.step === 'title') {
      ad.title = text;
      ad.prevStep = 'title';
      ad.step = 'description';
      return bot.sendMessage(chatId, 'Введите описание:', backButton());
    }

    // --- ВВОД ОПИСАНИЯ ---
    if (ad.step === 'description') {
      ad.description = text;
      ad.prevStep = 'description';
      ad.step = 'price';
      return bot.sendMessage(chatId, 'Введите цену (или "договорная"):', backButton());
    }

    // --- ВВОД ЦЕНЫ ---
    if (ad.step === 'price') {
      ad.price = text.toLowerCase() === 'договорная' ? 'Договорная' : text;
      ad.prevStep = 'price';
      if (msg.from.username) {
        ad.contact = `@${msg.from.username}`;
        await previewAd(chatId, ad, userId);
      } else {
        ad.step = 'contact';
        bot.sendMessage(chatId, 'Введите ваш контакт (телефон или Telegram):', backButton());
      }
    }

    // --- ВВОД КОНТАКТА ---
    if (ad.step === 'contact') {
      ad.contact = text;
      await previewAd(chatId, ad, userId);
    }
  } catch (e) {
    console.error('message handler error', e);
  }
});

// === ОБРАБОТКА ФОТО ===
const pendingAlbums = {};
bot.on('photo', async (msg) => {
  try {
    const userId = String(msg.from.id);
    const chatId = msg.chat.id;
    const ad = ads[userId];
    if (!ad || ad.step !== 'photos') return;

    if (msg.media_group_id) {
      if (!pendingAlbums[msg.media_group_id]) pendingAlbums[msg.media_group_id] = [];
      pendingAlbums[msg.media_group_id].push(msg);

      setTimeout(async () => {
        const album = pendingAlbums[msg.media_group_id];
        if (!album) return;
        album.sort((a, b) => a.message_id - b.message_id);
        const photos = album.map(m => m.photo[m.photo.length - 1].file_id).slice(0, 5);
        ad.photos = photos;
        delete pendingAlbums[msg.media_group_id];

        ad.prevStep = 'photos';
        ad.step = 'title';
        bot.sendMessage(chatId, 'Введите заголовок:', backButton());
      }, 600);
    } else {
      ad.photos = msg.photo.map(p => p.file_id).slice(0, 5);
      ad.prevStep = 'photos';
      ad.step = 'title';
      bot.sendMessage(chatId, 'Введите заголовок:', backButton());
    }
  } catch (e) {
    console.error('photo handler error', e);
  }
});

// === ПРЕДПРОСМОТР ===
async function previewAd(chatId, ad, ownerId) {
  try {
    ad.step = 'confirm';
    const date = new Date().toLocaleString('ru-RU');
    const caption = `
📅 <b>${date}</b>
📦 <b>Категория:</b> ${ad.category}
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>Цена:</b> ${ad.price}
👤 <b>Контакт:</b> ${ad.contact}
    `;
    await bot.sendMediaGroup(chatId, ad.photos.map((p, i) => ({
      type: 'photo',
      media: p,
      caption: i === ad.photos.length - 1 ? caption : undefined,
      parse_mode: 'HTML',
    })));
    await bot.sendMessage(chatId, '✅ Проверьте объявление перед отправкой:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Отправить на модерацию', callback_data: `send_to_moderation_${ownerId}` }],
          [{ text: '✏️ Изменить', callback_data: `edit_menu_${ownerId}` }, { text: '🗑️ Удалить', callback_data: `delete_ad_${ownerId}` }],
        ],
      },
    });
  } catch (e) {
    console.error('previewAd error', e);
  }
}

// === CALLBACKS ===
bot.on('callback_query', async (query) => {
  try {
    await bot.answerCallbackQuery(query.id);
    const data = query.data || '';
    const senderId = String(query.from.id);

    // --- меню редактирования ---
    if (data.startsWith('edit_menu_')) {
      const ownerId = data.split('_')[2];
      const ad = ads[ownerId];
      if (!ad) return;
      return bot.sendMessage(senderId, 'Что вы хотите изменить?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Категорию', callback_data: `edit_field_${ownerId}_category` }],
            [{ text: '🖼 Фото', callback_data: `edit_field_${ownerId}_photos` }],
            [{ text: '📝 Заголовок', callback_data: `edit_field_${ownerId}_title` }],
            [{ text: '💬 Описание', callback_data: `edit_field_${ownerId}_description` }],
            [{ text: '💰 Цену', callback_data: `edit_field_${ownerId}_price` }],
            [{ text: '👤 Контакт', callback_data: `edit_field_${ownerId}_contact` }],
          ],
        },
      });
    }

    // --- редактирование конкретного поля ---
    if (data.startsWith('edit_field_')) {
      const [, , ownerId, field] = data.split('_');
      const ad = ads[ownerId];
      if (!ad) return;
      ad.step = field;
      ad.prevStep = 'confirm';

      switch (field) {
        case 'category': return bot.sendMessage(senderId, 'Выберите новую категорию:', categoryKeyboard());
        case 'photos': return bot.sendMessage(senderId, 'Отправьте новые фото (1–5 шт):', backButton());
        case 'title': return bot.sendMessage(senderId, 'Введите новый заголовок:', backButton());
        case 'description': return bot.sendMessage(senderId, 'Введите новое описание:', backButton());
        case 'price': return bot.sendMessage(senderId, 'Введите новую цену:', backButton());
        case 'contact': return bot.sendMessage(senderId, 'Введите новый контакт:', backButton());
      }
    }

    // --- отправка на модерацию ---
    if (data.startsWith('send_to_moderation_')) {
      const ownerId = data.split('_')[3];
      const ad = ads[ownerId];
      if (!ad) return;

      pendingAds[ownerId] = ad;
      const date = new Date().toLocaleString('ru-RU');
      const caption = `
📅 <b>${date}</b>
📦 <b>${ad.category}</b>
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>${ad.price}</b>
👤 <b>${ad.contact}</b>
      `;
      await bot.sendMediaGroup(MOD_CHAT_ID, ad.photos.map((p, i) => ({
        type: 'photo',
        media: p,
        caption: i === ad.photos.length - 1 ? caption : undefined,
        parse_mode: 'HTML',
      })));
      await bot.sendMessage(MOD_CHAT_ID, `🕵️ Новое объявление от ${ad.contact}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Одобрить', callback_data: `approve_${ownerId}` }, { text: '❌ Отклонить', callback_data: `reject_${ownerId}` }],
          ],
        },
      });
      return;
    }

    // --- одобрение ---
    if (data.startsWith('approve_')) {
      const ownerId = data.split('_')[1];
      const ad = pendingAds[ownerId];
      if (!ad) return;
      const target = CATEGORY_TARGETS[ad.category];
      const date = new Date().toLocaleString('ru-RU');
      const caption = `
📅 <b>${date}</b>
📦 <b>${ad.category}</b>
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>${ad.price}</b>
👤 <b>${ad.contact}</b>
      `;
      const sent = await bot.sendMediaGroup(target.chatId, ad.photos.map((p, i) => ({
        type: 'photo',
        media: p,
        caption: i === ad.photos.length - 1 ? caption : undefined,
        parse_mode: 'HTML',
      })), { message_thread_id: target.threadId });

      const mainMsgId = sent[sent.length - 1].message_id;
      ad.messageId = mainMsgId;
      await bot.sendMessage(target.chatId, '📢 Объявление опубликовано', {
        message_thread_id: target.threadId,
        reply_to_message_id: mainMsgId,
      });

      await bot.sendMessage(ownerId, `🎉 Ваше объявление опубликовано в категории ${ad.category}!`);
      delete pendingAds[ownerId];
      return;
    }

    // --- отклонение ---
    if (data.startsWith('reject_')) {
      const ownerId = data.split('_')[1];
      delete pendingAds[ownerId];
      await bot.sendMessage(ownerId, '❌ Ваше объявление отклонено модератором.');
      return;
    }

  } catch (e) {
    console.error('callback_query handler error', e);
  }
});

console.log('✅ Бот запущен и готов к работе...');
