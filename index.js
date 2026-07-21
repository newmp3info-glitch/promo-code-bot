const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// Read the bot token safely from Render Environment Variables
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Your exact channel username
const CHANNEL_USERNAME = '@vipyonofreecode';

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

// Automatically catch new posts instantly from your channel
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username.toLowerCase()}` : '';
    const chatId = msg.chat.id.toString();
    
    // Accept post if username matches OR if chat id matches channel type
    if (chatUsername === CHANNEL_USERNAME.toLowerCase() || msg.chat.type === 'channel') {
        let text = msg.caption || msg.text || '';
        const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
        const replyMarkup = msg.reply_markup || null;
        
        if (text) {
            const words = text.split(/\s+/);
            const postContent = {
                text: text,
                photo: photo,
                replyMarkup: replyMarkup
            };

            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9._]/g, '').toLowerCase();
                if (cleanWord.length >= 1) { // Allows single letters like "y" or any short code
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

            if (!postDatabase['all_posts']) {
                postDatabase['all_posts'] = [];
            }
            const globalExists = postDatabase['all_posts'].some(p => p.text === text);
            if (!globalExists) {
                postDatabase['all_posts'].push(postContent);
                savePosts();
            }

            // Broadcast directly and instantly to all bot users with exact formatting, photo, links & buttons
            botUsers.forEach(userId => {
                sendPostToUser(userId, postContent);
            });

            console.log("Channel post captured successfully and broadcasted to all users!");
        }
    }
});

// Helper function to send post cleanly with exact photo, text, inline buttons and links
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
            bot.sendPhoto(userId, post.photo, { caption: post.text, ...options }).catch(e => {});
        });
    } else {
        bot.sendMessage(userId, post.text, { parse_mode: "Markdown", ...options }).catch(err => {
            bot.sendMessage(userId, post.text, options).catch(e => {});
        });
    }
}

// Handle user interactions and instant search
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

            if (postDatabase[query] && postDatabase[query].length > 0) {
                foundPosts = postDatabase[query];
            } else {
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

console.log("Ultimate working bot is running successfully...");
