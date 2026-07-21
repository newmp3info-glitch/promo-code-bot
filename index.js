
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

// Catch channel posts and store their message IDs and keywords
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username}` : '';
    
    if (chatUsername.toLowerCase() === CHANNEL_USERNAME.toLowerCase()) {
        const text = msg.text || msg.caption || '';
        const messageId = msg.message_id;
        const chatId = msg.chat.id;
        
        if (text) {
            const lowerText = text.toLowerCase();
            const words = lowerText.split(/\s+/);
            
            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9]/g, '');
                if (cleanWord.length > 2) {
                    if (!postDatabase[cleanWord]) {
                        postDatabase[cleanWord] = [];
                    }
                    // Save both messageId and chatId so we can forward the exact post
                    const postData = { chatId: chatId, messageId: messageId };
                    
                    // Avoid duplicate entries
                    const exists = postDatabase[cleanWord].some(p => p.messageId === messageId);
                    if (!exists) {
                        postDatabase[cleanWord].push(postData);
                        saveDatabase();
                    }
                }
            });
            console.log("Channel post cached with Media & Buttons support!");
        }
    }
});

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Type any game name to get the latest promo code from the channel.");
});

// Search handler - Forwards the exact original post with photo, links, and buttons
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (postDatabase[query] && postDatabase[query].length > 0) {
            const latestPost = postDatabase[query][postDatabase[query].length - 1];
            
            // Forward the exact original message from the channel (includes photo, caption, links, and buttons)
            bot.forwardMessage(chatId, latestPost.chatId, latestPost.messageId)
               .catch(err => {
                   bot.sendMessage(chatId, "Error loading the post. Please make sure the bot has admin rights.");
               });
        } else {
            bot.sendMessage(chatId, `No promo post found for "${text}". Make sure to post it in the channel first.`);
        }
    }
});

console.log("Media & Button Forwarder Bot is running smoothly...");

