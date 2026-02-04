# Используем легкий официальный Node.js
FROM node:20-alpine

# Рабочая директория внутри контейнера
WORKDIR /app

# Устанавливаем зависимости отдельно (кэш Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Копируем исходники
COPY . .

# ❗ .env НЕ копируем — переменные задаются в relaxdev
# BOT_TOKEN, MOD_CHAT_ID и т.д. задаются через ENV

# Чтобы логи сразу писались в stdout
ENV NODE_ENV=production

# Запуск бота
CMD ["node", "index.js"]
