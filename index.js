const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// Read the bot token safely from Render Environment Variables
const token = process.env.BOT_TOKEN;
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

// Automatically catch new posts from channel, save and broadcast instantly
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username}` : '';
    
    if (chatUsername.toLowerCase() === CHANNEL_USERNAME.toLowerCase()) {
        let text = msg.caption || msg.text || '';
        const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
        const replyMarkup = msg.reply_markup || null;
        
        if (text) {
            // Automatically make promo codes tap-to-copy using markdown code block format
            // This safely wraps potential promo code words or terms containing dots/alphanumerics
            const words = text.split(/\s+/);
            
            const postContent = {
                text: text,
                photo: photo,
                replyMarkup: replyMarkup
            };

            // Store words as keywords without stripping dots so names like "neta.vip" match completely
            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9._]/g, '').toLowerCase();
                if (cleanWord.length > 1) {
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

            // Global backup index
            if (!postDatabase['all_posts']) {
                postDatabase['all_posts'] = [];
            }
            const globalExists = postDatabase['all_posts'].some(p => p.text === text);
            if (!globalExists) {
                postDatabase['all_posts'].push(postContent);
                savePosts();
            }

            // Broadcast directly to all existing users instantly with media, buttons, and exact formatting
            botUsers.forEach(userId => {
                sendPostToUser(userId, postContent);
            });

            console.log("Exact channel post captured, saved, and broadcasted instantly!");
        }
    }
});

// Helper function to send post cleanly with exact media, text, links and buttons
function sendPostToUser(userId, post) {
    const options = {};
    if (post.replyMarkup) {
        options.reply_markup = post.replyMarkup;
    }

    if (post.photo) {
        bot.sendPhoto(userId, post.photo, { 
            caption: post.text, 
            parse_mode: "Markdown",
            ...options 
        }).catch(err => {
            // Fallback without parse_mode if special markdown symbols conflict
            bot.sendPhoto(userId, post.photo, { caption: post.text, ...options }).catch(e => {});
        });
    } else {
        bot.sendMessage(userId, post.text, { parse_mode: "Markdown", ...options }).catch(err => {
            bot.sendMessage(userId, post.text, options).catch(e => {});
        });
    }
}

// Handle user interactions, English /start message, and smart search
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!botUsers.includes(chatId)) {
        botUsers.push(chatId);
        saveUsers();
    }

    if (text) {
        if (text.startsWith('/start')) {
            const welcomeText = "Welcome to the Official Promo Code Bot!\n\n" +
                                "⚠️ **Notice:** Here you will get **Only Yono Promo Code**. No other games or unrelated content will be provided here.\n\n" +
                                "🚀 **All updates and promo codes for any new Yono games will be available here first!**\n\n" +
                                "📢 **How to get codes instantly:**\n" +
                                "• Whenever you join, you will automatically receive new posts.\n" +
                                "• **Need codes right now?** Just type and **search the game name** in the chat. The bot will instantly send you the available promo codes right away!";
            
            bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
        } else {
            const query = text.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
            let foundPosts = [];

            // 1. Direct exact keyword match
            if (postDatabase[query] && postDatabase[query].length > 0) {
                foundPosts = postDatabase[query];
            } else {
                // 2. Smart flexible search matching
                for (let key in postDatabase) {
                    if (key.includes(query) || query.includes(key)) {
                        if (Array.isArray(postDatabase[key])) {
                            postDatabase[key].forEach(p => {
                                if (!foundPosts.some(existing => existing.text === p.text)) {
                                    foundPosts.push(p);
                                }
                            });
                        }
                    }
                }
            }

            if (foundPosts.length > 0) {
                foundPosts.forEach(post => {
                    sendPostToUser(chatId, post);
                });
            } else {
                bot.sendMessage(chatId, `Promo code for "${text}" is not available right now. You will get it as soon as it arrives!`);
            }
        }
    }
});

console.log("Bot is fully running with exact channel sync and unmasked dots support...");
        
