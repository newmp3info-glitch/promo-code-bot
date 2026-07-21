const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

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

// পোস্ট এবং তার সাথে থাকা বাটন বা লিংক পারফেক্টলি সেভ করার ফাংশন
function savePostContent(text, photo, replyMarkup) {
    if (text || photo) {
        const postContent = {
            text: text || '',
            photo: photo,
            replyMarkup: replyMarkup || null
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

// চ্যানেলে পোস্ট ফরওয়ার্ড করলে বা দিলে তা বাটনসহ ক্যাচ করবে
bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username.toLowerCase()}` : '';
    
    if (chatUsername === TARGET_CHANNEL.toLowerCase()) {
        let text = msg.caption || msg.text || '';
        const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
        const replyMarkup = msg.reply_markup || null;

        savePostContent(text, photo, replyMarkup);
    }
});

// রিস্টোর করার সময় বাটন ও লিংক হুবহু ফিরিয়ে দেওয়ার ফাংশন
function restorePostsToChannel(chatId) {
    if (postDatabase['all_posts'] && postDatabase['all_posts'].length > 0) {
        bot.sendMessage(chatId, `Starting to restore ${postDatabase['all_posts'].length} posts with buttons to the channel...`);
        
        postDatabase['all_posts'].forEach((post, index) => {
            setTimeout(() => {
                const options = {};
                // এখানে আসল ইনলাইন বাটন বা ইউআরএল লিংক যুক্ত করা হলো
                if (post.replyMarkup) {
                    options.reply_markup = post.replyMarkup;
                }

                if (post.photo) {
                    bot.sendPhoto(TARGET_CHANNEL, post.photo, { 
                        caption: post.text, 
                        parse_mode: "Markdown", 
                        ...options 
                    }).catch(err => {
                        // যদি কোনো কারণে Markdown এ সমস্যা হয়, নরমাল টেক্সটে পাঠাবে যাতে বাটন নষ্ট না হয়
                        bot.sendPhoto(TARGET_CHANNEL, post.photo, { caption: post.text, ...options }).catch(e => {});
                    });
                } else if (post.text) {
                    bot.sendMessage(TARGET_CHANNEL, post.text, { 
                        parse_mode: "Markdown", 
                        ...options 
                    }).catch(err => {
                        bot.sendMessage(TARGET_CHANNEL, post.text, options).catch(e => {});
                    });
                }
            }, index * 1200); // প্রতিটি পোস্টের মাঝে ১.২ সেকেন্ড বিরতি রাখা হলো যাতে টেলিগ্রাম ব্লক না করে
        });
    } else {
        bot.sendMessage(chatId, "No saved posts found in database to restore!");
    }
}

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
                                "⚠️ **Notice:** Here you will get **Only Yono Promo Code**.\n\n" +
                                "👉 **Commands:**\n" +
                                "• Type `/restore` to push all saved posts to your channel with original buttons & links.";
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
                bot.sendMessage(chatId, `Promo code for "${text}" is not available right now.`);
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

console.log("Bot with full button & link support is running successfully...");
