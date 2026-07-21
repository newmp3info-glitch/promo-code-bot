
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// Enter your exact channel username here
const CHANNEL_USERNAME = '@VipYonoFreeCode';

// Temporary memory to store channel posts automatically
const postDatabase = {};

// Dummy server to prevent Render free tier port binding errors
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Automatically catch new posts only from your specific channel
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username}` : '';
    
    if (chatUsername.toLowerCase() === CHANNEL_USERNAME.toLowerCase()) {
        const text = msg.text || msg.caption;
        if (text) {
            const lowerText = text.toLowerCase();
            const words = lowerText.split(' ');
            
            words.forEach(word => {
                if (word.length > 2) {
                    if (!postDatabase[word]) {
                        postDatabase[word] = [];
                    }
                    if (!postDatabase[word].includes(text)) {
                        postDatabase[word].push(text);
                    }
                }
            });
            console.log("New post cached from your channel!");
        }
    }
});

// Start command in English
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Type any game name or keyword to get the latest promo code from the channel.");
});

// When user searches for a game/code
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const query = text.trim().toLowerCase();
        
        if (postDatabase[query] && postDatabase[query].length > 0) {
            const latestPost = postDatabase[query][postDatabase[query].length - 1];
            bot.sendMessage(chatId, `Latest Promo Post Found:\n\n${latestPost}`);
        } else {
            bot.sendMessage(chatId, `No recent promo post found for "${text}". Make sure the bot is an admin in your channel and the keyword matches.`);
        }
    }
});

console.log("Channel-specific Promo Bot is running in English...");

