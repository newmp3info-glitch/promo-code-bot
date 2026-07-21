
            
            const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// Replace with your bot token
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU
';
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

// Automatically catch new posts from channel and broadcast directly to all users
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username}` : '';
    
    if (chatUsername.toLowerCase() === CHANNEL_USERNAME.toLowerCase()) {
        const text = msg.caption || msg.text || '';
        const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
        const replyMarkup = msg.reply_markup || null;
        
        if (text) {
            const lowerText = text.toLowerCase();
            const words = lowerText.split(/\s+/);
            
            const postContent = {
                text: text,
                photo: photo,
                replyMarkup: replyMarkup
            };

            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9]/g, '');
                if (cleanWord.length > 2) {
                    if (!postDatabase[cleanWord]) {
                        postDatabase[cleanWord] = [];
                    }
                    const exists = postDatabase[cleanWord].some(p => p.text === text);
                    if (!exists) {
                        postDatabase[cleanWord].push(postContent);
                        savePosts();
                    }
                }
            });

            // Broadcast directly to all users instantly
            botUsers.forEach(userId => {
                sendPostToUser(userId, postContent);
            });

            console.log("New channel post broadcasted directly to all users!");
        }
    }
});

// Helper function to send post cleanly
function sendPostToUser(userId, post) {
    const options = {};
    if (post.replyMarkup) {
        options.reply_markup = post.replyMarkup;
    }

    if (post.photo) {
        bot.sendPhoto(userId, post.photo, { 
            caption: post.text, 
            ...options 
        }).catch(err => {});
    } else {
        bot.sendMessage(userId, post.text, options).catch(err => {});
    }
}

// Handle user interactions, detailed /start message, and search
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!botUsers.includes(chatId)) {
        botUsers.push(chatId);
        saveUsers();
    }

    if (text) {
        if (text.startsWith('/start')) {
            // Updated welcome message with your exact requirement: Only Yono Promo Code
            const welcomeText = "Welcome to the Official Promo Code Bot!\n\n" +
                                "⚠️ **Notice:** Here you will get **Only Yono Promo Code**. No other games or unrelated content will be provided here.\n\n" +
                                "📢 **How to use:**\n" +
                                "• You will receive all the posts broadcasted here automatically, and you can easily collect your promo codes directly from them.\n" +
                                "• If there are too many posts and you can't find your desired one, simply **type and search the game name** you need. The bot will instantly send you the required code!";
            
            bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
        } else {
            const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (postDatabase[query] && postDatabase[query].length > 0) {
                postDatabase[query].forEach(post => {
                    sendPostToUser(chatId, post);
                });
            } else {
                bot.sendMessage(chatId, `No promo post found for "${text}". Please type the correct game name.`);
            }
        }
    }
});

console.log("Bot is running successfully with updated notice...");
