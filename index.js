

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// Enter your exact channel username here (e.g., @VipYonoFreeCode)
const CHANNEL_USERNAME = '@VipYonoFreeCode';

// File to store channel posts permanently
const DATA_FILE = 'posts.json';

let postDatabase = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        postDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        postDatabase = {};
    }
}

function saveDatabase() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(postDatabase, null, 2));
}

// Dummy server to keep the bot alive on Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Catch both text messages and photo captions from the channel
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username}` : '';
    
    if (chatUsername.toLowerCase() === CHANNEL_USERNAME.toLowerCase()) {
        const text = msg.text || msg.caption; // Captures text or photo caption
        if (text) {
            const lowerText = text.toLowerCase();
            
            // Store the full post text mapped by individual words/keywords
            const words = lowerText.split(/\s+/);
            words.forEach(word => {
                // Clean punctuation from words
                const cleanWord = word.replace(/[^a-z0-9]/g, '');
                if (cleanWord.length > 2) {
                    if (!postDatabase[cleanWord]) {
                        postDatabase[cleanWord] = [];
                    }
                    if (!postDatabase[cleanWord].includes(text)) {
                        postDatabase[cleanWord].push(text);
                        saveDatabase();
                    }
                }
            });
            console.log("Channel post (with photo/text) cached successfully!");
        }
    }
});

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Type any game name to get the latest promo code from the channel.");
});

// Search handler
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (postDatabase[query] && postDatabase[query].length > 0) {
            const latestPost = postDatabase[query][postDatabase[query].length - 1];
            bot.sendMessage(chatId, `Latest Promo Post Found:\n\n${latestPost}`);
        } else {
            bot.sendMessage(chatId, `No promo post found for "${text}". Please make sure to forward or publish a new post in the channel after saving this code.`);
        }
    }
});

console.log("Fixed Channel Bot is running smoothly...");
