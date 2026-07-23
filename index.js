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

// স্মার্ট ফরম্যাটিং ফাংশন
function smartFormatPost(text, entities) {
    if (!text) return '';

    if (text.includes('All Yono Apps') && !text.toLowerCase().includes('code')) {
        return text; 
    }

    // ডাউনলোড লিংক বের করার লজিক (সম্পূর্ণ অপরিবর্তিত)
    let downloadUrl = '';
    if (entities && entities.length > 0) {
        entities.forEach(entity => {
            if (entity.type === 'text_link' && entity.url) {
                if (!entity.url.includes('t.me') && !entity.url.includes('telegram')) {
                    downloadUrl = entity.url;
                }
            } else if (entity.type === 'url') {
                let extractedUrl = text.substring(entity.offset, entity.offset + entity.length);
                if (extractedUrl && !extractedUrl.includes('t.me') && !extractedUrl.includes('telegram')) {
                    downloadUrl = extractedUrl;
                }
            }
        });
    }

    if (!downloadUrl) {
        let urlMatch = text.match(/(https?:\/\/[^\s<]+)/g);
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
    let nonEmtpyCount = 0;

    lines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) return;
        let lower = trimmed.toLowerCase();

        // ১. হ্যাশট্যাগ ফিল্টার
        if (trimmed.startsWith('#')) {
            let tags = trimmed.match(/#\w+/g);
            if (tags) {
                tags.forEach(t => {
                    if (!hashtags.includes(t)) hashtags.push(t);
                });
            }
            return;
        }

        nonEmtpyCount++;

        // ২. সর্বউপরের গেমের নাম / টাইটেল লাইনটি ১০০% বোল্ড হবে
        if (nonEmtpyCount === 1) {
            let cleanLine = trimmed.replace(/<[^>]*>/g, '');
            formattedLines.push(`<b>${cleanLine}</b>`);
            return;
        }

        // ৩. প্রমো কোড ট্যাপ করলে কপির জন্য (অপরিবর্তিত)
        if (lower.includes('code') && !lower.startsWith('http') && !lower.includes('app link') && !lower.includes('join this channel') && !lower.includes('never miss')) {
            let parts = trimmed.split(/➔|->|➜|:/);
            if (parts.length > 1) {
                let label = parts[0].trim();
                let rawCode = parts.slice(1).join(':').replace(/<[^>]*>/g, '').replace(/`/g, '').trim();
                let safeCode = rawCode.replace(/\./g, '.\u200B');
                formattedLines.push(`<b>${label}</b>: <code>${safeCode}</code>`);
            } else {
                let safeTrimmed = trimmed.replace(/\./g, '.\u200B');
                formattedLines.push(`<code>${safeTrimmed}</code>`);
            }
        } 
        // ৪. ডাউনলোড লিংক (অপরিবর্তিত)
        else if (lower.includes('download now') || lower.includes('game link') || lower.includes('link')) {
            if (downloadUrl) {
                if (lower.includes('download now')) {
                    let replacedLine = trimmed.replace(/download now/gi, `<a href="${downloadUrl}"><b>Download Now</b></a>`);
                    formattedLines.push(replacedLine);
                } else {
                    formattedLines.push(`<b>🎰 GAME LINK </b> ➜ <a href="${downloadUrl}"><b>Download Now</b></a>📱`);
                }
            } else {
                formattedLines.push(trimmed);
            }
        } 
        // ৫. মিনিমাম উইথড্রল লাইনটি বোল্ড হবে
        else if (lower.includes('minimum') || lower.includes('withdrawal')) {
            let cleanLine = trimmed.replace(/<[^>]*>/g, '');
            formattedLines.push(`<b>${cleanLine}</b>`);
        } 
        // ৬. নিউ ইউজার বোনাস এবং নিচের জয়েন চ্যানেল মেসেজ দুটোই Quote Box-এ থাকবে
        else if (
            lower.includes('signup bonus') || 
            lower.includes('new users') || 
            lower.includes('join this channel') || 
            lower.includes('pin this channel') ||
            lower.includes('never miss') ||
            lower.includes('important promo code') ||
            trimmed.startsWith('🔥') ||
            trimmed.startsWith('🎁')
        ) {
            let cleanLine = trimmed.replace(/<[^>]*>/g, '');
            formattedLines.push(`<blockquote>${cleanLine}</blockquote>`);
        } 
        else {
            formattedLines.push(trimmed);
        }
    });

    if (hashtags.length > 0) {
        formattedLines.push(`<blockquote><tg-spoiler>${hashtags.join(' ')}</tg-spoiler></blockquote>`);
    }

    return formattedLines.join('\n\n');
}

// অটোমেটিক ব্রডকাস্ট ফাংশন
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
            const welcomeText = `<b>Welcome to the Official Promo Code Bot!</b>\n\n<b>⚠️ Notice:</b> Here you will get Only Yono Promo Code. No other games or unrelated content will be provided here.\n\n🚀 All updates and promo codes for any new Yono games will be available here first!\n\n📢 <b>How to get codes instantly:</b>\n• Whenever you join, you will automatically receive new posts.\n• Need codes right now? Just type and search the game name in the chat. The bot will instantly send you the available promo codes right away!`;
            bot.sendMessage(chatId, welcomeText, { parse_mode: "HTML" });
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

console.log("Bot running with full UI alignment and welcome message update...");
