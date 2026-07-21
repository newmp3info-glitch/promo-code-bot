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

// নিখুঁত টেক্সট প্রসেসিং ফাংশন
function cleanAndFormatText(msg) {
    let text = msg.caption || msg.text || '';
    let entities = msg.caption_entities || msg.entities || [];

    // ১. প্রমো কোডকে টেলিগ্রামের কোড ফরম্যাটে (`) রূপান্তর করা, যাতে ইউজার একবার ট্যাপ করলেই কপি হয়ে যায়
    text = text.replace(/(PROMO CODE\s*(?:➔|->|➡️)?\s*)(`?)([a-zA-Z0-9._-]+)(`?)/gi, (match, p1, q1, code, q2) => {
        return `${p1}\`${code}\``;
    });

    // ২. ডাউনলোড লিংক বা "Download Now" অংশটিকে নিখুঁতভাবে Markdown লিংকে রূপান্তর করা
    if (entities.length > 0) {
        let downloadUrl = '';
        // প্রথমে টেলিগ্রামের আসল এন্টিটি থেকে ডাউনলোড লিংকটি খুঁজে বের করা
        entities.forEach(entity => {
            if (entity.type === 'text_link' && entity.url) {
                if (entity.url.includes('http') && !entity.url.includes('t.me')) {
                    downloadUrl = entity.url;
                }
            } else if (entity.type === 'url') {
                // ইউআরএল এন্টিটি থাকলে তা ফেচ করা
            }
        });

        // যদি সরাসরি টেক্সট লিংক না পাওয়া যায়, তবে সাধারণ নিয়মে খোঁজা
        entities.forEach(entity => {
            if (entity.type === 'text_link' && entity.url) {
                let start = entity.offset;
                let end = start + entity.length;
                let linkText = text.substring(start, end);
                
                if (linkText.toLowerCase().includes('download') || linkText.toLowerCase().includes('link')) {
                    downloadUrl = entity.url;
                }
            }
        });

        // যদি ডাউনলোড লিংক পাওয়া যায়, তবে "Download Now" এর সাথে সেটি যুক্ত করে দেওয়া
        if (downloadUrl) {
            // আগের আজেবাজে লিংক টেক্সট পরিষ্কার করে স্ট্যান্ডার্ড "Download Now" তৈরি করা
            text = text.replace(/([A-Z0-9\s]*LINK\s*[➔->➡️]*\s*Download\s*Now📱?|Download\s*Now📱?)/gi, `[Download Now 📱](${downloadUrl})`);
        }
    }

    // ৩. হ্যাশট্যাগগুলোকে কোনো এক্সট্রা ব্র্যাকেট বা টেক্সট ছাড়াই সম্পূর্ণ কালো স্পয়লার (||#tag||) করা
    const hashtagRegex = /#\w+/g;
    let match;
    let tagsToHide = [];
    while ((match = hashtagRegex.exec(text)) !== null) {
        if (!tagsToHide.includes(match[0])) {
            tagsToHide.push(match[0]);
        }
    }
    
    tagsToHide.forEach(tag => {
        let escapedTag = tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let regex = new RegExp(escapedTag, 'g');
        text = text.replace(regex, `||${tag}||`);
    });

    return text;
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

function sendPostUser(userId, post) {
    // helper placeholder
}

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

console.log("Bot with ultimate text formatting is running successfully...");
