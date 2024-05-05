import { bot } from '../index.mjs'
import { message } from "telegraf/filters";

export async function memes() {
    const userImages = new Map();

    const adminUserId = '5361485758';

    const channelId = '@itzdtech';

    bot.on(message('photo'), async (ctx) => {
        if (ctx.chat.type !== 'private') {
            return
        }
        const userId = ctx.from.id;
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        // 存储用户发送的图片
        userImages.set(userId, { photoId, title: '' });

        // 提示用户输入图片标题
        await ctx.reply('请输入图片的标题:');
    });

    bot.on(message('text'), async (ctx) => {
        const userId = ctx.from.id;
        const title = ctx.message.text;

        // 检查用户是否发送过图片
        if (userImages.has(userId)) {
            const userData = userImages.get(userId);
            userData.title = title;

            // 发送图片和标题给管理员审核
            await ctx.telegram.sendPhoto(adminUserId, userData.photoId, {
                caption: `来自用户 ${userId} 的图片,标题: ${title}`,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '批准', callback_data: `approve:${userId}` },
                            { text: '拒绝', callback_data: `reject:${userId}` }
                        ]
                    ]
                }
            });

            await ctx.reply('图片已发送给管理员审核。');
        }
    });

    bot.action(/^(approve|reject):(\d+)$/, async (ctx) => {
        const action = ctx.match[1];
        const userId = parseInt(ctx.match[2]);

        if (userImages.has(userId)) {
            const userData = userImages.get(userId);

            if (action === 'approve') {
                // 将图片发送到指定频道
                await ctx.telegram.sendPhoto(channelId, userData.photoId, {
                    caption: "# " + userData.title
                });
                await ctx.answerCbQuery('图片已审核通过并发送到频道。');
            } else {
                await ctx.answerCbQuery('图片已被拒绝。');
            }

            // 清除存储的图片和标题
            userImages.delete(userId);
        } else {
            await ctx.answerCbQuery('未找到相关的图片数据。');
        }
    });
}

