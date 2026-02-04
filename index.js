const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// ================== НАСТРОЙКИ ==================
const token = process.env.BOT_TOKEN;
const MOD_CHAT_ID = process.env.MOD_CHAT_ID || '178060329';
const CHAT_ID = '@easymarket_ge';

if (!token) {
  console.error('❌ BOT_TOKEN не задан');
  process.exit(1);
}

// ❗ polling = false
const bot = new TelegramBot(token, { polling: false });
const app = express();

app.use(express.json());

// ================== ДАННЫЕ ==================
const categories = [['👩 Женское'], ['📱 Электроника'], ['🚗 Авто']];

const CATEGORY_TARGETS = {
  '👩 Женское': { chatId: CHAT_ID, threadId: 17 },
  '📱 Электроника': { chatId: CHAT_ID, threadId: 9 },
  '🚗 Авто': { chatId: CHAT_ID, threadId: 8 },
};

const ads = {};
const pendingAds = {};

// ================== КЛАВИАТУРЫ ==================
const backButton = () => ({
  reply_markup: { keyboard: [[{ text: '🔙 Назад' }]], resize_keyboard: true },
});

const categoryKeyboard = () => ({
  reply_markup: { keyboard: categories, resize_keyboard: true },
});

// ================== START ==================
bot.onText(/\/start|\/create/, (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  ads[userId] = { step: 'category', photos: [] };

  bot.sendMessage(chatId, 'Выберите категорию:', categoryKeyboard());
});

// ================== ТЕКСТ ==================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text.trim();
  const ad = ads[userId];

  if (!ad) return;

  if (text === '🔙 Назад') {
    ad.step = ad.prevStep || 'category';
    return bot.sendMessage(chatId, 'Продолжаем:', backButton());
  }

  switch (ad.step) {
    case 'category':
      if (!categories.flat().includes(text)) return;
      ad.category = text;
      ad.prevStep = 'category';
      ad.step = 'photos';
      return bot.sendMessage(chatId, 'Отправьте 1–5 фото:', backButton());

    case 'title':
      ad.title = text;
      ad.prevStep = 'title';
      ad.step = 'description';
      return bot.sendMessage(chatId, 'Введите описание:', backButton());

    case 'description':
      ad.description = text;
      ad.prevStep = 'description';
      ad.step = 'price';
      return bot.sendMessage(chatId, 'Введите цену:', backButton());

    case 'price':
      ad.price = text;
      ad.contact = msg.from.username ? `@${msg.from.username}` : '';
      return previewAd(chatId, ad, userId);
  }
});

// ================== ФОТО ==================
bot.on('photo', async (msg) => {
  const userId = String(msg.from.id);
  const chatId = msg.chat.id;
  const ad = ads[userId];

  if (!ad || ad.step !== 'photos') return;

  const photo = msg.photo[msg.photo.length - 1];
  ad.photos.push(photo.file_id);

  if (ad.photos.length >= 1) {
    ad.prevStep = 'photos';
    ad.step = 'title';
    return bot.sendMessage(chatId, 'Введите заголовок:', backButton());
  }
});

// ================== ПРЕВЬЮ ==================
async function previewAd(chatId, ad, ownerId) {
  ad.step = 'confirm';

  const caption = `
📦 <b>${ad.category}</b>
📝 <b>${ad.title}</b>
💬 ${ad.description}
💰 <b>${ad.price}</b>
👤 <b>${ad.contact}</b>
`.trim();

  await bot.sendMediaGroup(chatId, ad.photos.map((p, i) => ({
    type: 'photo',
    media: p,
    caption: i === ad.photos.length - 1 ? caption : undefined,
    parse_mode: 'HTML',
  })));

  await bot.sendMessage(chatId, 'Подтвердите объявление:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Отправить', callback_data: `send_${ownerId}` }],
        [{ text: '🗑 Удалить', callback_data: `delete_${ownerId}` }],
      ],
    },
  });
}

// ================== CALLBACK ==================
bot.on('callback_query', async (q) => {
  const data = q.data;
  const userId = String(q.from.id);
  await bot.answerCallbackQuery(q.id);

  if (data.startsWith('send_')) {
    pendingAds[userId] = ads[userId];
    delete ads[userId];
    await bot.sendMessage(userId, '🕓 Отправлено на модерацию');
  }

  if (data.startsWith('delete_')) {
    delete ads[userId];
    await bot.sendMessage(userId, '🗑 Удалено');
  }
});

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (e) {
    console.error("❌ Webhook error:", e);
    res.sendStatus(500);
  }
});

// ================== SERVER ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Bot webhook server running on port ${PORT}`);
});

