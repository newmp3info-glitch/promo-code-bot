


            const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// Enter your exact channel username here
const CHANNEL_USERNAME = '@VipYonoFreeCode';

const POSTS_FILE = 'posts.json';
const USERS_FILE = 'users.json';

let postDatabase = {};
if (fs.existsSync(POSTS_FILE)) {
    try {
        postDatabase = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    } catch (e) {
        postDatabase = {};
    }
}

function savePosts() {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(postDatabase, null, 2));
}

let botUsers = [];
if (fs.existsSync(USERS_FILE)) {
    try {
        botUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        botUsers = [];
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(botUsers, null, 2));
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

// Automatically catch new posts from channel and broadcast permanently to all users
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
                    const postData = { chatId: chatId, messageId: messageId };
                    const exists = postDatabase[cleanWord].some(p => p.messageId === messageId);
                    if (!exists) {
                        postDatabase[cleanWord].push(postData);
                        savePosts();
                    }
                }
            });

            // Broadcast permanently to all active bot users without deletion
            botUsers.forEach(userId => {
                bot.forwardMessage(userId, chatId, messageId)
                   .catch(err => {
                       // Ignore blocked users
                   });
            });

            console.log("New post permanently broadcasted to all users!");
        }
    }
});

// Handle user interactions, start command, and permanent search
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!botUsers.includes(chatId)) {
        botUsers.push(chatId);
        saveUsers();
    }

    if (text) {
        if (text.startsWith('/start')) {
            bot.sendMessage(chatId, "Welcome! You will receive all channel updates here automatically. You can also search for any game name anytime.");
        } else {
            const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (postDatabase[query] && postDatabase[query].length > 0) {
                // Show all matched posts permanently
                postDatabase[query].forEach(latestPost => {
                    bot.forwardMessage(chatId, latestPost.chatId, latestPost.messageId)
                       .catch(err => {
                           bot.sendMessage(chatId, "Error loading the post.");
                       });
                });
            } else {
                bot.sendMessage(chatId, `No promo post found for "${text}".`);
            }
        }
    }
});

console.log("Permanent Channel Feed Bot is running smoothly...");
