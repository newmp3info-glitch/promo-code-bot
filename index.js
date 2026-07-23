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

// স্মার্ট ফরম্যাটিং ফাংশন (যেকোনো ধরণের প্রমো/ভিআইপি কোডকে কপি-ফ্রেন্ডলি করবে এবং লিংক হওয়া আটকাবে)
function smartFormatPost(text, entities) {
    if (!text) return '';

    if (text.includes('All Yono Apps') || text.includes('Download') || (text.split('\n').length > 5 && !text.toLowerCase().includes('code'))) {
        return text; 
    }

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
        let lower = trimmed.toLowerCase();

        if (trimmed.startsWith('#')) {
            let tags = trimmed.match(/#\w+/g);
            if (tags) {
                tags.forEach(t => {
                    if (!hashtags.includes(t)) hashtags.push(t);
                });
            }
        } 
        // যেকোনো লাইনে 'code' থাকলে (যেমন: VIP 0-20 code, promo code) সেটিকে ধরবে, তবে মূল অ্যাপ ডাউনলোড লিংকে ধরবে না
        else if (lower.includes('code') && !lower.startsWith('http') && !lower.includes('app link')) {
            let parts = trimmed.split(/➔|->|➜|:/);
            if (parts.length > 1) {
                let label = parts[0].trim();
                let rawCode = parts.slice(1).join(':').replace(/<[^>]*>/g, '').replace(/`/g, '').trim();
                
                // ডট ( . ) এর পর অদৃশ্য অক্ষর যুক্ত করা যাতে টেলিগ্রাম এটিকে লিংক না বানায়
                let safeCode = rawCode.replace(/\./g, '.\u200B');
                
                formattedLines.push(`<b>${label}</b>: <code>${safeCode}</code>`);
            } else {
                let safeTrimmed = trimmed.replace(/\./g, '.\u200B');
                formattedLines.push(`<code>${safeTrimmed}</code>`);
            }
        } 
        else if (lower.includes('download now') || lower.includes('app link') || lower.includes('link ::') || lower.includes('link:')) {
            if (downloadUrl) {
                formattedLines.push(`<b>🎰 GAME LINK </b> <a href='${downloadUrl}'>☞ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗡𝗼𝘄</a>📱`);
            } else {
                formattedLines.push(trimmed);
            }
        } 
        else if (trimmed !== '') {
            if (lower.includes('signup bonus') || lower.includes('join this channel')) {
                formattedLines.push(`<blockquote>${trimmed.replace(/<[^>]*>/g, '')}</blockquote>`);
            } else if (!trimmed.startsWith('#')) {
                formattedLines.push(trimmed);
            }
        }
    });

    if (hashtags.length > 0) {
        formattedLines.push(`<blockquote><tg-spoiler>${hashtags.join(' ')}</tg-spoiler></blockquote>`);
    }

    return formattedLines.join('\n\n');
}

// সকল ইউজারের কাছে অটোমেটিক ব্রডকাস্টের ফাংশন
function broadcastPostToAllUsers(post) {
    if (!botUsers || botUsers.length === 0) return;

    console.log(`Broadcasting new post to ${botUsers.length} users...`);

    const options = { 
        parse_mode: "HTML",
        disable_web_page_preview: true 
    };
    if (post.replyMarkup) {
        options.reply_markup = post.replyMarkup;
    }

    botUsers.forEach((userId, index) => {
        setTimeout(() => {
            if (post.photo) {
                bot.sendPhoto(userId, post.photo, { caption: post.text, ...options }).catch(err => {
                    console.error(`Failed to send to ${userId}:`, err.message);
                });
            } else if (post.text) {
                bot.sendMessage(userId, post.text, options).catch(err => {
                    console.error(`Failed to send to ${userId}:`, err.message);
                });
            }
        }, index * 40); 
    });
}

function savePostContent(msg) {
    let rawText = msg.caption || msg.text || '';
    let entities = msg.caption_entities || msg.entities || [];
    
    let text = smartFormatPost(rawText, entities);
    if (!text) text = rawText;
    
    const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    const replyMarkup = msg.reply_markup || null;
    
    let postContent = null;

    if (text || photo) {
        postContent = {
            text: text,
            photo: photo,
            replyMarkup: replyMarkup || null
        };

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

    return postContent;
}

bot.on('channel_post', (msg) => {
    const chatUsername = msg.chat.username ? `@${msg.chat.username.toLowerCase()}` : '';
    if (chatUsername === TARGET_CHANNEL.toLowerCase()) {
        const newPost = savePostContent(msg);
        if (newPost) {
            broadcastPostToAllUsers(newPost);
        }
    }
});

function restorePostsToChannel(chatId) {
    if (postDatabase['all_posts'] && postDatabase['all_posts'].length > 0) {
        bot.sendMessage(chatId, `Restoring ${postDatabase['all_posts'].length} posts safely with intact links...`);
        
        postDatabase['all_posts'].forEach((post, index) => {
            setTimeout(() => {
                const options = { 
                    parse_mode: "HTML",
                    disable_web_page_preview: true 
                };
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
    const options = { 
        parse_mode: "HTML",
        disable_web_page_preview: true 
    };
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

console.log("Bot running successfully with promo code fix & auto broadcast...");
