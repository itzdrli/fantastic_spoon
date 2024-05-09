import { InlineKeyboard } from 'grammy';
import { bot } from "../index.mjs"
import { logger } from "../utils/logger.mjs";
import { downloadAndProcessImage } from "../utils/downloadAndProcessImage.mjs";

const userImages = new Map();

const adminUserId = '5361485758';
const channelId = '@itzdtech';

export async function memes() {
    bot.on(':photo', async (ctx) => {
        if (ctx.chat.type !== 'private') {
            return;
        }
        const userId = ctx.from.id.toString();
        const photoId = ctx.msg.photo.pop().file_id;
        const username = ctx.from.username
        userImages.set(userId.toString(), { photoId, title: '', userId, username, anonymous: false});

        await ctx.reply('请输入图片的标题:');
    });

    bot.on(':text', async (ctx) => {
        const userId = ctx.from.id.toString();
        const title = ctx.msg.text

        if (userImages.has(userId)) {
            const userData = userImages.get(userId);
            userData.title = title;
            await ctx.reply(`匿名投稿?`, {
                reply_markup: {
                    inline_keyboard: new InlineKeyboard().text('是', 'anonymous:yes').row().text('否', 'anonymous:no')
                    .inline_keyboard,
                }
            })
        }
    });

    bot.callbackQuery(/anonymous:(yes|no)/, async (ctx) => {
        const userId = ctx.from.id.toString();
        const userData = userImages.get(userId);
        if (ctx.match[1] === 'yes') {
            userData.anonymous = true
        }
        await ctx.api.sendPhoto(adminUserId, userData.photoId, {
            caption: `来自用户 @${userData.username}(${userId}) 的图片,\n标题: ${userData.title}\n匿名: ${userData.anonymous ? '是' : '否'}`,
            reply_markup: new InlineKeyboard().text('批准', `approve:${userId}`).row().text('拒绝', `reject:${userId}`)
        });
        await ctx.answerCallbackQuery('图片已发送至管理员等待审核。');
    })

    bot.callbackQuery(/^(approve|reject):(\d+)$/, async (ctx) => {
        const action = ctx.match[1];
        const userId = ctx.match[2];
        if (userImages.has(userId)) {
            const userData = userImages.get(userId);

            let messageLink = "https://t.me/itzdtech/";
            if (action === 'approve') {
                if (userData.anonymous) {
                    const res = await ctx.api.sendPhoto(channelId, userData.photoId, {
                        caption: `# ${userData.title}\n投 稿: @FantasticSpoonBot`
                    });
                    messageLink +=  + res.message_id;
                } else {
                    const res = await ctx.api.sendPhoto(channelId, userData.photoId, {
                        caption: `# ${userData.title}\nvia @${userData.username}\n投 稿: @FantasticSpoonBot`
                    });
                    messageLink += res.message_id;
                }
                logger.info(messageLink)
                await ctx.answerCallbackQuery('图片已审核通过并发送到频道.');
                await ctx.api.sendMessage(userId, `您的图片已审核通过并发布.\n${messageLink}`);
                // await downloadAndProcessImage(userData.photoId, userData.title)
            } else {
                await ctx.answerCallbackQuery('图片已被拒绝.');
                await ctx.api.sendMessage(userId, '您的图片未通过审核.');
            }

            userImages.delete(userId);
        } else {
            await ctx.answerCallbackQuery('未找到相关的图片数据。');
        }
    });
}