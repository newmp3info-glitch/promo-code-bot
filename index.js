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

// ১০০% ডায়নামিক ফাংশন: চ্যানেলে যে পোস্টই দেওয়া হবে, বট সেটাই নিখুঁতভাবে ফরম্যাট করে সেভ করবে
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

        // ২. হ্যাশট্যাগগুলো আলাদা করে ফেলা যাতে পরে স্পয়লার ট্যাগ দেওয়া যায়
        if (trimmed.startsWith('#')) {
            let tags = trimmed.match(/#\w+/g);
            if (tags) {
                tags.forEach(t => {
                    if (!hashtags.includes(t)) hashtags.push(t);
                });
            }
        } 
        // ৩. প্রমো কোড লাইন হ্যান্ডেল করা এবং <code> ট্যাগ নিশ্চিত করা যাতে ট্যাপ করলেই কপি হয়
        else if (trimmed.toLowerCase().includes('promo code') && (trimmed.includes('➔') || trimmed.includes('->') || trimmed.includes('PROMO CODE'))) {
            let parts = trimmed.split(/➔|->/);
            if (parts.length > 1) {
                let codeValue = parts[1].replace(/<[^>]*>/g, '').replace(/`|<.*?>/g, '').trim();
                formattedLines.push(`<b>🎟️ PROMO CODE </b> ➜ <code>${codeValue}</code>`);
            } else {
                formattedLines.push(trimmed);
            }
        } 
        // ৪. ডাউনলোড লিংক লাইন হ্যান্ডেল করা
        else if (trimmed.toLowerCase().includes('download now') || trimmed.toLowerCase().includes('link')) {
            if (downloadUrl) {
                // যে লিংকে পাঠানো হবে সেটি ডায়নামিকভাবে এখানে বসবে
                formattedLines.push(`<b>🎰 GAME LINK </b> <a href='${downloadUrl}'>☞ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗡𝗼𝘄</a>📱`);
            } else {
                formattedLines.push(trimmed);
            }
        } 
        // ৫. বাকী সাধারণ লাইন ও ব্লককোড ঠিক রাখা
        else if (trimmed !== '') {
            if (trimmed.toLowerCase().includes('signup bonus') || trimmed.toLowerCase().includes('join this channel')) {
                formattedLines.push(`<blockquote>${trimmed.replace(/<[^>]*>/g, '')}</blockquote>`);
            } else if (!trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
            }
        }
    });

    // ৬. হ্যাশট্যাগগুলো শেষে স্পয়লার হিসেবে যোগ করা
    if (hashtags.length > 0) {
        formattedLines.push(`<blockquote><tg-spoiler>${hashtags.join(' ')}</tg-spoiler></blockquote>`);
    }

    return formattedLines.join('\n');
}

function savePostContent(msg) {
    let rawText = msg.caption || msg.text || '';
    let entities = msg.caption_entities || msg.entities || [];
    
    // চ্যানেলে আসা পোস্টের নিজস্ব টেক্সট ডায়নামিকভাবে প্রসেস হবে (কোনো ফিক্সড বা হার্ডকোডেড টেক্সট থাকবে না)
    let text = formatPostToHTML(rawText, entities);
    if (!text) text = rawText; // কোনো কারণে ফরম্যাট না হলে অরিজিনাল টেক্সট থাকবে
    
    const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    const replyMarkup = msg.reply_markup || null;
    
    if (text || photo) {
        const postContent = {
            text: text,
            photo: photo,
            replyMarkup: replyMarkup || null
        };

        // পোস্টের টেক্সট থেকে প্রতিটি শব্দ বা গেমের নাম আলাদা করে ইনডেক্স করা যাতে আলাদা গেম আলাদাভাবে সার্চে আসে
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
        bot.sendMessage(chatId, `Restoring ${postDatabase['all_posts'].length} unique posts...`);
        
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

console.log("Fully dynamic multi-post bot is running successfully...");
