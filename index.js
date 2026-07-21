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

// ১০০% ডায়নামিক ফাংশন: আপনার অরিজিনাল পোস্টের প্রমো কোডকে <code> ট্যাগে রেখে এবং সঠিক স্পেস দিয়ে সেভ করবে
function formatPostToHTML(text, entities) {
    if (!text) return '';

    // ১. ডাউনলোড বা অন্য কোনো লিংক থাকলে তা খুঁজে বের করা
    let downloadUrl = '';
    if (entities && entities.length > 0) {
        entities.forEach(entity => {
            if (entity.type === 'text_link' && entity.url) {
                if (!entity.url.includes('t.me') && !entity.url.includes('telegram')) {
                    downloadUrl = entity.url;
                }
            }
        });
    }

    if (!downloadUrl) {
        let urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
        if (urlMatch) {
            for (let u of urlMatch) {
                if (!u.includes('t.me') && !u.includes('telegram')) {
                    downloadUrl = u;
                    break;
                }
            }
        }
    }

    let lines = text.split('\n');
    let formattedLines = [];
    let hashtags = [];

    lines.forEach(line => {
        let trimmed = line.trim();

        // ২. হ্যাশট্যাগগুলো আলাদা করে স্পয়লারের জন্য জমিয়ে রাখা
        if (trimmed.startsWith('#')) {
            let tags = trimmed.match(/#\w+/g);
            if (tags) {
                tags.forEach(t => {
                    if (!hashtags.includes(t)) hashtags.push(t);
                });
            }
        } 
        // ৩. প্রমো কোডের লাইন শনাক্ত করে সেটিকে আবশ্যিকভাবেই <code> ট্যাগে মোড়ানো (যাতে টেলিগ্রাম লিংক না বানায় এবং ট্যাপ করলে কপি হয়)
        else if (trimmed.toLowerCase().includes('promo code') && (trimmed.includes('➔') || trimmed.includes('->') || trimmed.includes('PROMO CODE'))) {
            let parts = trimmed.split(/➔|->/);
            if (parts.length > 1) {
                let codeValue = parts[1].replace(/<[^>]*>/g, '').replace(/`|<.*?>/g, '').trim();
                formattedLines.push(`<b>🎟️ PROMO CODE </b> ➜ <code>${codeValue}</code>`);
            } else {
                formattedLines.push(trimmed);
            }
        } 
        // ৪. যদি ইউজার সরাসরি ডট বা ডোমেন নাম দিয়ে প্রমো কোড লেখে, সেটিকেও <code> ট্যাগে রূপান্তর করা
        else if ((trimmed.includes('.com') || trimmed.includes('.vip') || trimmed.includes('.in')) && !trimmed.toLowerCase().includes('http') && !trimmed.toLowerCase().includes('link')) {
            let cleanCode = trimmed.replace(/<[^>]*>/g, '').replace(/`|<.*?>/g, '').trim();
            formattedLines.push(`<code>${cleanCode}</code>`);
        }
        // ৫. ডাউনলোড লিংক বাটন ঠিক রাখা
        else if (trimmed.toLowerCase().includes('download now') || trimmed.toLowerCase().includes('link')) {
            if (downloadUrl) {
                formattedLines.push(`<b>🎰 GAME LINK </b> <a href='${downloadUrl}'>☞ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗡𝗼𝘄</a>📱`);
            } else {
                formattedLines.push(trimmed);
            }
        } 
        // ৬. বাকী সব সাধারণ লাইন ও ব্লককোড ঠিক রাখা
        else if (trimmed !== '') {
            if (trimmed.toLowerCase().includes('signup bonus') || trimmed.toLowerCase().includes('join this channel')) {
                formattedLines.push(`<blockquote>${trimmed.replace(/<[^>]*>/g, '')}</blockquote>`);
            } else if (!trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
            }
        }
    });

    // ৭. হ্যাশট্যাগগুলো শেষে স্পয়লার হিসেবে যোগ করা
    if (hashtags.length > 0) {
        formattedLines.push(`<blockquote><tg-spoiler>${hashtags.join(' ')}</tg-spoiler></blockquote>`);
    }

    // আপনার চাহিদা অনুযায়ী লাইনের মাঝে সঠিক দূরত্ব বা স্পেস বজায় রাখা
    return formattedLines.join('\n\n');
}

function savePostContent(msg) {
    let rawText = msg.caption || msg.text || '';
    let entities = msg.caption_entities || msg.entities || [];
    
    let text = formatPostToHTML(rawText, entities);
    if (!text) text = rawText;
    
    const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    const replyMarkup = msg.reply_markup || null;
    
    if (text || photo) {
        const postContent = {
            text: text,
            photo: photo,
            replyMarkup: replyMarkup || null
        };

        // প্রতিটি পোস্টের নিজস্ব টেক্সট থেকে কিওয়ার্ড ইনডেক্স করা যাতে আলাদা গেম আলাদাভাবে সার্চে আসে
        if (rawText) {
            const words = rawText.split(/\s+/);
            words.forEach(word => {
                const cleanWord = word.replace(/[^a-z0-9._]/g, '').toLowerCase();
                if (cleanWord.length >= 2) {
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
        bot.sendMessage(chatId, `Restoring ${postDatabase['all_posts'].length} unique posts with fixed copyable promo codes...`);
        
        postDatabase['all_posts'].forEach((post, index) => {
            setTimeout(() => {
                const options = { parse_mode: "HTML" };
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
            bot.sendMessage(chatId, "Welcome! Send any game name or promo keyword to get its post.", { parse_mode: "Markdown" });
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
                bot.sendMessage(chatId, `No promo code or post found for "${text}".`);
            }
        }
    }
});

function sendPostToUser(userId, post) {
    const options = { parse_mode: "HTML" };
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

console.log("Ultimate Telegram Bot is running successfully...");
