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
        botUsers = JSON.parse(USERS_FILE, 'utf8');
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

// ১০০% নিখুঁত ফরম্যাটিং ফাংশন
function cleanAndFormatText(msg) {
    let text = msg.caption || msg.text || '';
    let entities = msg.caption_entities || msg.entities || [];

    // ১. টেলিগ্রামের এন্টিটি থেকে আসল ডাউনলোড লিংকটি বের করে নেওয়া
    let downloadUrl = '';
    if (entities && entities.length > 0) {
        entities.forEach(entity => {
            if (entity.type === 'text_link' && entity.url) {
                // যে লিংকটি ডাউনলোড বা গেম সম্পর্কিত, সেটি টার্গেট করা
                if (!entity.url.includes('t.me') && !entity.url.includes('telegram')) {
                    downloadUrl = entity.url;
                }
            }
        });
    }

    let lines = text.split('\n');
    let formattedLines = [];
    let hashtagsGroup = [];

    lines.forEach(line => {
        let trimmedLine = line.trim();

        // ২. হ্যাশট্যাগগুলোকে আলাদা করে সংগ্রহ করা যাতে একসাথে ব্লার/হাইড করা যায়
        if (trimmedLine.startsWith('#') || trimmedLine.includes('#Verified') || trimmedLine.includes('#promocode')) {
            let tagsInLine = trimmedLine.match(/#\w+/g);
            if (tagsInLine) {
                tagsInLine.forEach(tag => hashtagsGroup.push(tag));
            }
        } 
        // ৩. প্রমো কোড থেকে লিংক সরিয়ে সাধারণ টেক্সট বা ব্যাকটিক কোড করা যাতে লিংকে না যায়
        else if (trimmedLine.toLowerCase().includes('promo code') && (trimmedLine.includes('➔') || trimmedLine.includes('->'))) {
            let parts = trimmedLine.split(/➔|->/);
            if (parts.length > 1) {
                let codePart = parts[1].replace(/<[^>]*>/g, '').trim();
                // ব্যাকটিক (`) ব্যবহার করলে টেলিগ্রাম এটাকে মনোস্পেস করে, যা ইউজার ট্যাপ করলেই কপি হয় এবং কোনো ব্রাউজারে যায় না
                formattedLines.push(`${parts[0].trim()} ➔ \`${codePart}\``);
            } else {
                formattedLines.push(trimmedLine);
            }
        } 
        // ৪. সাধারণ লাইনগুলো যেমন আছে রাখা
        else if (trimmedLine !== '') {
            // যদি লাইনে Download Now থাকে এবং আমাদের কাছে ডাউনলোড লিংক থাকে, তবে সেটি Markdown লিংক বানিয়ে দেওয়া
            if (downloadUrl && (trimmedLine.toLowerCase().includes('download now') || trimmedLine.toLowerCase().includes('link'))) {
                // আগের সব টেক্সট বাদ দিয়ে নিখুঁত "Download Now" লিংক তৈরি করা
                let prefixMatch = trimmedLine.match(/^(.*?)(LINK|Now)/i);
                let prefix = prefixMatch ? prefixMatch[1] : '';
                formattedLines.push(`🎁 ${prefix}LINK ➔ [Download Now 📱](${downloadUrl})`);
            } else {
                formattedLines.push(trimmedLine);
            }
        }
    });

    // ৫. সব হ্যাশট্যাগগুলোকে একসাথে একটি লাইনে নিয়ে তার দুইপাশে স্পয়লার (`||`) দিয়ে সম্পূর্ণ কালো করে হাইড করে দেওয়া
    if (hashtagsGroup.length > 0) {
        let uniqueTags = [...new Set(hashtagsGroup)].join(' ');
        formattedLines.push(`||${uniqueTags}||`);
    }

    return formattedLines.join('\n');
}

function savePostContent(msg) {
    let text = cleanAndFormatText(msg);
    const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    const replyMarkup = msg.reply_markup || null;
    
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

bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username.toLowerCase()}` : '';
    if (chatUsername === TARGET_CHANNEL.toLowerCase()) {
        savePostContent(msg);
    }
});

function restorePostsToChannel(chatId) {
    if (postDatabase['all_posts'] && postDatabase['all_posts'].length > 0) {
        bot.sendMessage(chatId, `Starting to restore ${postDatabase['all_posts'].length} posts with perfect formatting...`);
        
        postDatabase['all_posts'].forEach((post, index) => {
            setTimeout(() => {
                const options = { parse_mode: "Markdown" };
                if (post.replyMarkup) {
                    options.reply_markup = post.replyMarkup;
                }

                if (post.photo) {
                    bot.sendPhoto(TARGET_CHANNEL, post.photo, { 
                        caption: post.text, 
                        ...options 
                    }).catch(err => {
                        bot.sendPhoto(TARGET_CHANNEL, post.photo, { caption: post.text, reply_markup: post.replyMarkup }).catch(e => {});
                    });
                } else if (post.text) {
                    bot.sendMessage(TARGET_CHANNEL, post.text, options).catch(err => {
                        bot.sendMessage(TARGET_CHANNEL, post.text, { reply_markup: post.replyMarkup }).catch(e => {});
                    });
                }
            }, index * 1200);
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
            bot.sendMessage(chatId, "Welcome! Type `/restore` to push all posts to your channel.", { parse_mode: "Markdown" });
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
    const options = { parse_mode: "Markdown" };
    if (post.replyMarkup) {
        options.reply_markup = post.replyMarkup;
    }

    if (post.photo) {
        bot.sendPhoto(userId, post.photo, { caption: post.text, ...options }).catch(err => {
            bot.sendPhoto(userId, post.photo, { caption: post.text, reply_markup: post.replyMarkup }).catch(e => {});
        });
    } else if (post.text) {
        bot.sendMessage(userId, post.text, options).catch(err => {
            bot.sendMessage(userId, post.text, { reply_markup: post.replyMarkup }).catch(e => {});
        });
    }
}

console.log("Bot with ultimate fixed formatting is running successfully...");
