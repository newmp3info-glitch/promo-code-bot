const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// Your channel username or ID (where the bot will look for posts)
const CHANNEL_USERNAME = '@VipYonoFreeCode';

// Dummy server to prevent Render free tier port binding errors
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Please type the name of the game to get your promo code.");
});

// When user searches for a game name
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        // Bot receives the game name and checks the channel
        bot.sendMessage(chatId, `You requested a promo code for "${text}". Checking channel: ${CHANNEL_USERNAME}...`);
        
        // Note: Channel searching/fetching logic will search posts from your channel database
    }
});

console.log("Promo Code Bot with Channel Support is running in English...");
