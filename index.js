const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const SOURCE_CHANNEL = '@AllYonoRummyCode';
const TARGET_CHANNEL = '@VipYonoFreeCode';

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

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// পোস্ট প্রসেস করার কমন ফাংশন (যাতে ফরোয়ার্ড বা নতুন পোস্ট উভয়ই কাজ করে)
function handleIncomingPost(msg) {
    let text = msg.caption || msg.text || '';
    const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    const replyMarkup = msg.reply_markup || null;
    
    if (text || photo) {
        const postContent = {
            text: text || '',
            photo: photo,
            replyMarkup: replyMarkup
        };

        if (text) {
            const words = text.split(/\s+/);
            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9._]/g, '').toLowerCase();
                if (cleanWord.length >= 1) {
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
        }

        if (!postDatabase['all_posts']) {
            postDatabase['all_posts'] = [];
        }
        const globalExists = postDatabase['all_posts'].some(p => p.text === text);
        if (!globalExists) {
            postDatabase['all_posts'].push(postContent);
            savePosts();
        }
    }
}

// সোর্স চ্যানেল থেকে নতুন পোস্ট আসলে
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username.toLowerCase()}` : '';
    if (chatUsername === SOURCE_CHANNEL.toLowerCase()) {
        handleIncomingPost(msg);
        
        let text = msg.caption || msg.text || '';
        const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
        const replyMarkup = msg.reply_markup || null;
        
        const options = {};
        if (replyMarkup) options.reply_markup = replyMarkup;

        if (photo) {
            bot.sendPhoto(TARGET_CHANNEL, photo, { caption: text, parse_mode: "Markdown", ...options }).catch(e => {});
        } else if (text) {
            bot.sendMessage(TARGET_CHANNEL, text, { parse_mode: "Markdown", ...options }).catch(e => {});
        }
    }
});

// টার্গেট চ্যানেলে যদি আপনি পোস্ট ফরওয়ার্ড করেন, সেটিও ডাটাবেজে সেভ হবে
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!botUsers.includes(chatId)) {
        botUsers.push(chatId);
        saveUsers();
    }

    // যদি আপনার টার্গেট চ্যানেলে পোস্ট ফরোয়ার্ড করা হয়
    if (msg.chat.username && `@${msg.chat.username.toLowerCase()}` === TARGET_CHANNEL.toLowerCase()) {
        handleIncomingPost(msg);
        return;
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
        } else if (text.startsWith('/restore')) {
            restorePostsToChannel(chatId);
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
    } else if (post.text) {
        bot.sendMessage(userId, post.text, { parse_mode: "Markdown", ...options }).catch(err => {
            bot.sendMessage(userId, post.text, options).catch(e => {});
        });
    }
}

function restorePostsToChannel(chatId) {
    if (postDatabase['all_posts'] && postDatabase['all_posts'].length > 0) {
        bot.sendMessage(chatId, `Starting to restore ${postDatabase['all_posts'].length} posts to the channel...`);
        
        postDatabase['all_posts'].forEach((post, index) => {
            setTimeout(() => {
                const options = {};
                if (post.replyMarkup) {
                    options.reply_markup = post.replyMarkup;
                }

                if (post.photo) {
                    bot.sendPhoto(TARGET_CHANNEL, post.photo, { 
                        caption: post.text, 
                        parse_mode: "Markdown",
                        ...options 
                    }).catch(err => {});
                } else if (post.text) {
                    bot.sendMessage(TARGET_CHANNEL, post.text, { parse_mode: "Markdown", ...options }).catch(err => {});
                }
            }, index * 1000);
        });
    } else {
        bot.sendMessage(chatId, "No saved posts found in database to restore!");
    }
}

console.log("Bot with forward capture and restore is running successfully...");
                             
