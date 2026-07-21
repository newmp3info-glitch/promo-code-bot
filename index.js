
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// Your channel username
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

// Start command in English
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Please type the name of the game to get your promo code.");
});

// Message handler for game search
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const gameName = text.trim();
        
        // Response to user
        bot.sendMessage(chatId, `Searching promo code for "${gameName}" from channel ${CHANNEL_USERNAME}...`);
        
        // Note: To fetch real posts from a public channel via standard Bot API, 
        // the bot must be added as an Administrator to that channel, 
        // or you need to maintain a database/JSON file of your promo codes here.
    }
});

console.log("Promo Code Bot is running smoothly...");

