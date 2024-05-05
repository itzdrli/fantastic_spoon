import { bot } from '../index.mjs'
import { message } from "telegraf/filters";

export async function memes() {
    const userImages = new Map();

    const adminUserId = '5361485758';

    const channelId = '@itzdtech';

    bot.on(message('photo'), async (ctx) => {
        const userId = ctx.from.id;
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        userImages.set(userId, photoId);

        await ctx.reply('请输入图片的标题:');
    });

    bot.on(message('text'), async (ctx) => {
        const userId = ctx.from.id;
        const title = ctx.message.text;

        if (userImages.has(userId)) {
            const photoId = userImages.get(userId);

            await ctx.telegram.sendPhoto(adminUserId, photoId, {
                caption: `From: ${userId} ,Title: ${title}`
            });

            await ctx.reply('Awaiting for approval');

            userImages.delete(userId);
        }
    });

    bot.command('approve', (ctx) => {
        ctx.reply("11")
        if (ctx.from.id === adminUserId) {
            const photoId = ctx.message.reply_to_message.photo[0].file_id;
            const title = ctx.message.reply_to_message.caption.split(':')[1].trim();

            ctx.telegram.sendPhoto(channelId, photoId, {
                caption: title
            });

            ctx.reply('Approved');
        } else {
            ctx.reply("No Permission")
        }
    });
}

