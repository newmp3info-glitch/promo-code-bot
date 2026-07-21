const TelegramBot = require('node-telegram-bot-api');

// আপনার নতুন বটের টোকেন এখানে দিন
const token = '7734842773:AAE9wldHvcrCd9IbBWROj1SoYw4twDfw1zU';
const bot = new TelegramBot(token, { polling: true });

// আপনার চ্যানেლის ইউজারনেম বা আইডি (যেখান থেকে পোস্ট রিড করবে)
const CHANNEL_USERNAME = '@VipYonoFreeCode';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "স্বাগতম! প্রমো কোড পেতে যেকোনো গেমের নাম লিখে পাঠান বা নিচের কমান্ড ব্যবহার করুন।");
});

// ইউজার যখন কোনো গেমের নাম বা টেক্সট পাঠাবে
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        // এখানে বট ইউজারের কাঙ্ক্ষিত গেমের নাম রিসিভ করবে
        bot.sendMessage(chatId, `আপনি "${text}" এর প্রমো কোড চেয়েছেন। আমাদের চ্যানেল চেক করা হচ্ছে...`);
        
        // নোট: চ্যানেল থেকে অটো পোস্ট ফেচ করার লজিক এখানে যুক্ত করতে হবে 
        // যাতে চ্যানেল ডাটাবেজ বা চ্যানেল থেকে পোস্ট এনে ইউজারকে দেখানো যায়।
    }
});

console.log("New Promo Bot is running...");
