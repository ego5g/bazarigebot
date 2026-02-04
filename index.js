require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// === НАСТРОЙКИ ===
const token = process.env.BOT_TOKEN;

// ✅ ПРОВЕРКА ТОКЕНА
if (!token) {
  console.error('❌ ОШИБКА: BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

console.log('✅ Токен бота загружен');
console.log('🔧 Запуск бота...');

const CHAT_ID = '@easymarket_ge';
const MOD_CHAT_ID = process.env.MOD_CHAT_ID || '178060329';

// ✅ ВАЖНО: Добавляем обработку ошибок при создании бота
let bot;
try {
  bot = new TelegramBot(token, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });
  console.log('✅ Polling запущен');
} catch (error) {
  console.error('❌ Ошибка при создании бота:', error.message);
  process.exit(1);
}

// ✅ Обработка ошибок polling
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

// === КАТЕГОРИИ / THREAD ID ===
const categories = [['👩 Женское'], ['📱 Электроника'], ['🚗 Авто']];
const CATEGORY_TARGETS = {
  '👩 Женское': { chatId: CHAT_ID, threadId: 17, username: 'easymarket_ge' },
  '📱 Электроника': { chatId: CHAT_ID, threadId: 9, username: 'easymarket_ge' },
  '🚗 Авто': { chatId: CHAT_ID, threadId: 8, username: 'easymarket_ge' },
};

// === ХРАНИЛИЩЕ ===
const ads = {};
const pendingAds = {};

// === КЛАВИАТУРЫ ===
function backButton() {
  return { reply_markup: { keyboard: [[{ text: '🔙 Назад' }]], resize_keyboard: true } };
}
function categoryKeyboard() {
  return { reply_markup: { keyboard: categories, resize_keyboard: true, one_time_keyboard: true } };
}

// === /start ===
bot.onText(/\/start|\/create/i, (msg) => {
  console.log('📨 Получена команда /start от', msg.from.username || msg.from.id);
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  ads[userId] = { step: 'category', prevStep: null, photos: [] };
  bot.sendMessage(chatId, 'Выберите категорию:', categoryKeyboard());
});

// === ОБРАБОТКА ТЕКСТА ===
bot.on('message', async (msg) => {
  try {
    // ✅ Игнорируем команды (они обрабатываются отдельно)
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text?.trim();
    
    // ✅ Логирование входящих сообщений
    console.log('📩 Сообщение от', msg.from.username || userId, ':', text || '[фото]');
    
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
      console.log('✅ Категория выбрана:', text);

      if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

      ad.prevStep = 'category';
      ad.step = 'photos';
      return bot.sendMessage(chatId, 'Отправьте от 1 до 5 фото одним сообщением:', backButton());
    }

    // --- ВВОД ЗАГОЛОВКА ---
    if (ad.step === 'title') {
      ad.title = text;
      console.log('✅ Заголовок:', text);
      if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

      ad.prevStep = 'title';
      ad.step = 'description';
      return bot.sendMessage(chatId, 'Введите описание:', backButton());
    }

    // --- ВВОД ОПИСАНИЯ ---
    if (ad.step === 'description') {
      ad.description = text;
      console.log('✅ Описание:', text);
      if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

      ad.prevStep = 'description';
      ad.step = 'price';
      return bot.sendMessage(chatId, 'Введите цену (или "договорная"):', backButton());
    }

    // --- ВВОД ЦЕНЫ ---
    if (ad.step === 'price') {
      ad.price = text.toLowerCase() === 'договорная' ? 'Договорная' : text;
      console.log('✅ Цена:', ad.price);
      if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

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
      console.log('✅ Контакт:', text);
      return previewAd(chatId, ad, userId);
    }
  } catch (e) {
    console.error('❌ message handler error', e);
  }
});

// === ОБРАБОТКА ФОТО ===
const pendingAlbums = {};
bot.on('photo', async (msg) => {
  try {
    const userId = String(msg.from.id);
    const chatId = msg.chat.id;
    const ad = ads[userId];
    
    console.log('📸 Получено фото от', msg.from.username || userId);
    
    if (!ad || ad.step !== 'photos') {
      console.log('⚠️ Фото игнорируется - неверный шаг');
      return;
    }

    // если редактируем фото — очищаем старые
    if (ad.prevStep === 'confirm') ad.photos = [];

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

        console.log('✅ Альбом обработан:', photos.length, 'фото');

        if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

        ad.prevStep = 'photos';
        ad.step = 'title';
        bot.sendMessage(chatId, 'Введите заголовок:', backButton());
      }, 600);
    } else {
      const photo = msg.photo[msg.photo.length - 1];
      ad.photos = [photo.file_id];
      console.log('✅ Одно фото обработано');

      if (ad.prevStep === 'confirm') return previewAd(chatId, ad, userId);

      ad.prevStep = 'photos';
      ad.step = 'title';
      bot.sendMessage(chatId, 'Введите заголовок:', backButton());
    }
  } catch (e) {
    console.error('❌ photo handler error', e);
  }
});

// === ПРЕДПРОСМОТР ===
async function previewAd(chatId, ad, ownerId) {
  try {
    console.log('👀 Генерация предпросмотра для', ownerId);
    ad.step = 'confirm';
    const date = new Date().toLocaleString('ru-RU');
    const caption = `
📅 <b>${date}</b>
<b>Категория:</b> ${ad.category}
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>Цена:</b> ${ad.price}
👤 <b>Контакт:</b> ${ad.contact}
    `.trim();

    const sent = await bot.sendMediaGroup(chatId, ad.photos.map((p, i) => ({
      type: 'photo',
      media: p,
      caption: i === ad.photos.length - 1 ? caption : undefined,
      parse_mode: 'HTML',
    })));
    ad.previewMessageIds = sent.map(m => m.message_id);

    const keyboardMsg = await bot.sendMessage(chatId, '✅ Проверьте объявление перед отправкой:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Отправить на модерацию', callback_data: `send_to_moderation_${ownerId}` }],
          [{ text: '✏️ Изменить', callback_data: `edit_menu_${ownerId}` }, { text: '🗑️ Удалить', callback_data: `delete_ad_${ownerId}` }],
        ],
      },
    });

    ad.previewKeyboardMessageId = keyboardMsg.message_id;
    console.log('✅ Предпросмотр отправлен');

  } catch (e) {
    console.error('❌ previewAd error', e);
  }
}

// === CALLBACKS ===
bot.on('callback_query', async (query) => {
  try {
    await bot.answerCallbackQuery(query.id);
    console.log('🔘 Callback:', query.data);

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

    // --- редактирование поля ---
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

      console.log('📤 Отправка на модерацию:', ownerId);

      if (ad.previewKeyboardMessageId) {
        try {
          await bot.editMessageReplyMarkup(
            {
              inline_keyboard: [
                [
                  { text: '✏️ Изменить', callback_data: `edit_menu_${ownerId}` },
                  { text: '🗑️ Удалить', callback_data: `delete_ad_${ownerId}` },
                ],
              ],
            },
            { chat_id: ownerId, message_id: ad.previewKeyboardMessageId }
          );
        } catch (e) {
          console.warn('⚠️ Не удалось убрать кнопку:', e.message);
        }
      }

      const statusMsg = await bot.sendMessage(ownerId, '🕓 Ваше объявление отправлено на модерацию. Статус: <b>На проверке</b>', { parse_mode: 'HTML' });
      ad.statusMessageId = statusMsg.message_id;
      ad.status = 'pending';
      pendingAds[ownerId] = ad;

      const date = new Date().toLocaleString('ru-RU');
      const caption = `
📅 <b>${date}</b>
📦 <b>${ad.category}</b>
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>${ad.price}</b>
👤 <b>${ad.contact}</b>
      `.trim();

      await bot.sendMediaGroup(MOD_CHAT_ID, ad.photos.map((p, i) => ({
        type: 'photo',
        media: p,
        caption: i === ad.photos.length - 1 ? caption : undefined,
        parse_mode: 'HTML',
      })));

      await bot.sendMessage(MOD_CHAT_ID, `🕵️ Новое объявление от ${ad.contact}`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Одобрить', callback_data: `approve_${ownerId}` },
              { text: '❌ Отклонить', callback_data: `reject_${ownerId}` },
            ],
          ],
        },
      });

      console.log('✅ Отправлено модератору');
      return;
    }

    // --- удаление ---
    if (data.startsWith('delete_ad_')) {
      const ownerId = data.split('_')[2];
      const ad = ads[ownerId];
      if (!ad) return;

      if (ad.previewMessageIds && ad.previewMessageIds.length) {
        for (const msgId of ad.previewMessageIds) {
          try { await bot.deleteMessage(senderId, msgId); } catch (e) {}
        }
      }
      if (ad.previewKeyboardMessageId) {
        try { await bot.deleteMessage(senderId, ad.previewKeyboardMessageId); } catch (e) {}
      }

      delete ads[ownerId];
      await bot.sendMessage(senderId, '🗑 Объявление удалено.');
      console.log('🗑️ Объявление удалено:', ownerId);
      return;
    }

    // --- одобрение ---
    if (data.startsWith('approve_')) {
      const ownerId = data.split('_')[1];
      const ad = pendingAds[ownerId];
      if (!ad) return;

      console.log('✅ Одобрение объявления:', ownerId);

      const target = CATEGORY_TARGETS[ad.category];
      const date = new Date().toLocaleString('ru-RU');
      const caption = `
📅 <b>${date}</b>
📦 <b>${ad.category}</b>
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>${ad.price}</b>
👤 <b>${ad.contact}</b>
      `.trim();

      const sent = await bot.sendMediaGroup(target.chatId, ad.photos.map((p, i) => ({
        type: 'photo',
        media: p,
        caption: i === ad.photos.length - 1 ? caption : undefined,
        parse_mode: 'HTML',
      })), { message_thread_id: target.threadId });

      const mainMsgId = sent[sent.length - 1].message_id;
      const postLink = `https://t.me/${target.username}/${mainMsgId}`;

      await bot.sendMessage(
        ownerId,
        `🎉 Ваше объявление опубликовано в категории <b>${ad.category}</b>!\n\n` +
        `🔗 <b>Ссылка:</b> ${postLink}`,
        { parse_mode: 'HTML' }
      );

      if (ad.statusMessageId) {
        await bot.editMessageText('✅ Статус: <b>Опубликовано</b>', {
          chat_id: ownerId,
          message_id: ad.statusMessageId,
          parse_mode: 'HTML',
        });
      }

      delete pendingAds[ownerId];
      console.log('✅ Объявление опубликовано');
      return;
    }

    // --- отклонение ---
    if (data.startsWith('reject_')) {
      const ownerId = data.split('_')[1];
      delete pendingAds[ownerId];
      await bot.sendMessage(ownerId, '❌ Ваше объявление отклонено модератором.');
      if (ads[ownerId]?.statusMessageId) {
        await bot.editMessageText('❌ Статус: <b>Отклонено</b>', {
          chat_id: ownerId,
          message_id: ads[ownerId].statusMessageId,
          parse_mode: 'HTML',
        });
      }
      console.log('❌ Объявление отклонено:', ownerId);
      return;
    }

  } catch (e) {
    console.error('❌ callback_query error', e);
  }
});

// ✅ Проверка работоспособности
bot.getMe().then(info => {
  console.log('✅ Бот запущен успешно!');
  console.log('👤 Имя бота:', info.username);
  console.log('🆔 ID бота:', info.id);
}).catch(err => {
  console.error('❌ Не удалось получить информацию о боте:', err.message);
  process.exit(1);
});

// ✅ Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️ Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});

const http = require('http');

const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
}).listen(PORT, () => {
  console.log(`🌐 Healthcheck server running on port ${PORT}`);
});

