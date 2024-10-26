import { InlineKeyboard } from 'grammy';
import { bot } from "../index.mjs"
import { logger } from "../utils/logger.mjs";
import { downloadAndProcessImage } from "../utils/downloadAndProcessImage.mjs";

// 使用对象来存储用户的多个投稿
const userSubmissions = new Map();

const adminUserId = '5361485758';
const channelId = '@koimemes';

export async function memes() {
    bot.on([':photo', ':document'], async (ctx) => {
        if (ctx.chat.type !== 'private') return;
        
        const photoId = getPhotoId(ctx);
        if (!photoId) {
            await ctx.reply('请发送图片文件或照片。');
            return;
        }

        const userId = ctx.from.id.toString();
        const username = ctx.from.username;
        
        // 为用户创建新的投稿
        const submissionId = Date.now().toString();
        if (!userSubmissions.has(userId)) {
            userSubmissions.set(userId, new Map());
        }
        userSubmissions.get(userId).set(submissionId, { photoId, title: '', userId, username, anonymous: false });

        await ctx.reply('请输入图片的标题:', {
            reply_markup: new InlineKeyboard().text('取消', `cancel:${submissionId}`)
        });
    });

    bot.on(':text', async (ctx) => {
        const userId = ctx.from.id.toString();
        const title = ctx.msg.text;

        if (userSubmissions.has(userId)) {
            const userSubmissionMap = userSubmissions.get(userId);
            const lastSubmissionId = Array.from(userSubmissionMap.keys()).pop();
            const userData = userSubmissionMap.get(lastSubmissionId);
            
            if (!userData.title) {
                userData.title = title;
                await ctx.reply(`匿名投稿?`, {
                    reply_markup: new InlineKeyboard()
                        .text('是', `anonymous:yes:${lastSubmissionId}`)
                        .text('否', `anonymous:no:${lastSubmissionId}`)
                        .row()
                        .text('取消', `cancel:${lastSubmissionId}`)
                });
            }
        }
    });

    bot.callbackQuery(/anonymous:(yes|no):(\w+)/, async (ctx) => {
        const userId = ctx.from.id.toString();
        const submissionId = ctx.match[2];
        const userSubmissionMap = userSubmissions.get(userId);
        const userData = userSubmissionMap.get(submissionId);
        
        userData.anonymous = ctx.match[1] === 'yes';
        await ctx.api.editMessageText(userId, ctx.callbackQuery.message.message_id, '图片已发送至管理员等待审核。');
        await sendToAdmin(ctx, userData, submissionId);
        await ctx.answerCallbackQuery('图片已发送至管理员等待审核。');
    });

    bot.callbackQuery(/cancel:(\w+)/, async (ctx) => {
        const userId = ctx.from.id.toString();
        const submissionId = ctx.match[1];
        const userSubmissionMap = userSubmissions.get(userId);
        userSubmissionMap.delete(submissionId);
        await ctx.answerCallbackQuery('投稿已取消。');
        await ctx.api.editMessageText(userId, ctx.callbackQuery.message.message_id, '投稿已取消。');
    });

    bot.callbackQuery(/^(approve|reject):(\d+):(\w+)$/, async (ctx) => {
        const action = ctx.match[1];
        const userId = ctx.match[2];
        const submissionId = ctx.match[3];
        
        if (userSubmissions.has(userId)) {
            const userSubmissionMap = userSubmissions.get(userId);
            const userData = userSubmissionMap.get(submissionId);

            if (action === 'approve') {
                await approveSubmission(ctx, userData, userId);
            } else {
                await rejectSubmission(ctx, userId);
            }

            userSubmissionMap.delete(submissionId);
        } else {
            await ctx.answerCallbackQuery('未找到相关的图片数据。');
        }
    });
}

// 辅助函数
function getPhotoId(ctx) {
    if (ctx.msg.photo) {
        return ctx.msg.photo.pop().file_id;
    } else if (ctx.msg.document) {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const fileName = ctx.msg.document.file_name.toLowerCase();
        if (allowedExtensions.some(ext => fileName.endsWith(ext))) {
            return ctx.msg.document.file_id;
        }
    }
    return null;
}

async function sendToAdmin(ctx, userData, submissionId) {
    await ctx.api.sendPhoto(adminUserId, userData.photoId, {
        caption: `来自用户 @${userData.username}(${userData.userId}) 的图片,\n标题: ${userData.title}\n匿名: ${userData.anonymous ? '是' : '否'}`,
        reply_markup: new InlineKeyboard()
            .text('批准', `approve:${userData.userId}:${submissionId}`)
            .text('拒绝', `reject:${userData.userId}:${submissionId}`)
    });
}

async function approveSubmission(ctx, userData, userId) {
    let messageLink = "https://t.me/koimemes/";
    const caption = userData.anonymous
        ? `# ${userData.title}\n投稿: @FantasticSpoonBot`
        : `# ${userData.title}\nvia @${userData.username}\n投稿: @FantasticSpoonBot`;

    const res = await ctx.api.sendPhoto(channelId, userData.photoId, { caption });
    messageLink += res.message_id;

    await ctx.answerCallbackQuery('图片已审核通过并发送到频道.');
    await downloadAndProcessImage(userData.photoId, userData.title);
    await ctx.api.sendMessage(userId, `您的图片已审核通过并发布.\n${messageLink}`);
}

async function rejectSubmission(ctx, userId) {
    await ctx.answerCallbackQuery('图片已被拒绝.');
    await ctx.api.sendMessage(userId, '您的图片未通过审核.');
}