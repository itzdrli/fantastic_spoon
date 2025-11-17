import ky from "ky"
import { MediaInput, MediaUpload, Bot } from "gramio";
import logger from "../utils/logger";
import { kmemeApi } from "../utils/kmemeApi";
import { downloadTelegramFile, getFilenameFromPath } from "../utils/telegramFile";
import { valkeyClient } from "../utils/valkey";

const REVIEW_GROUP_ID = process.env.REVIEW_GROUP_ID!; 
const CHANNEL_USERNAME = "@koimemes"; 
const ADMIN_IDS = process.env.ADMIN_IDS?.split(",") || [];

interface SubmissionData {
  photoFileId: string;
  caption?: string;
  isAnonymous?: boolean;
  reviewMessageId?: number;
  username?: string;
  userId: number;
}

function normalizeCaption(caption: string): string {
  return caption.replace(/^#\s*/, "").trim();
}

function formatCaptionForTelegram(caption: string): string {
  const normalized = normalizeCaption(caption);
  return `# ${normalized}`;
}

export async function memeSubmit(bot: Bot) {
  bot.hears(
    (ctx) => ctx.chat.type === "private" && ctx.attachment?.attachmentType === "photo",
    async (ctx) => {
      const photo = ctx.photo?.[ctx.photo.length - 1];
      if (!photo) return;
      
      const caption = ctx.caption || "";
      const userId = ctx.from.id;
      const username = ctx.from.username || "无用户名";
      
      if (!caption) {
        await valkeyClient.setSubmission(userId, { photoFileId: photo.fileId, username, userId });
        await ctx.send("标题: ");
        return;
      }
      
      await valkeyClient.setSubmission(userId, { photoFileId: photo.fileId, caption, username, userId });
      await ctx.send("是否匿名发布？", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "是", callback_data: `anon_yes_${userId}` },
              { text: "否", callback_data: `anon_no_${userId}` },
              { text: "取消", callback_data: `anon_cancel_${userId}` }
            ]
          ]
        }
      });
    }
  );
  
  bot.hears(
    (ctx) => ctx.chat.type === "private" && !ctx.attachment,
    async (ctx) => {
      const userId = ctx.from.id;
      const submission = await valkeyClient.getSubmission(userId);
      
      if (submission && !submission.caption) {
        submission.caption = ctx.text || "";
        await valkeyClient.setSubmission(userId, submission);
        
        await ctx.send("是否匿名发布？", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "是", callback_data: `anon_yes_${userId}` },
                { text: "否", callback_data: `anon_no_${userId}` },
                { text: "取消", callback_data: `anon_cancel_${userId}` }
              ]
            ]
          }
        });
      }
    }
  );
  
  bot.callbackQuery(/^anon_(yes|no|cancel)_(\d+)$/, async (ctx) => {
    const action = ctx.queryData[1];
    const userId = parseInt(ctx.queryData[2]);
    
    if (ctx.from.id !== userId) {
      await ctx.answerCallbackQuery({ text: "这不是你的提交！" });
      return;
    }
    
    const submission = await valkeyClient.getSubmission(userId);
    if (!submission || !submission.caption) {
      await ctx.answerCallbackQuery({ text: "提交信息不完整！" });
      return;
    }
    
    if (action === "cancel") {
      await valkeyClient.deleteSubmission(userId);
      await ctx.editText("已取消提交。");
      await ctx.answerCallbackQuery({ text: "已取消" });
      return;
    }
    
    submission.isAnonymous = action === "yes";
    
    const fromText = submission.isAnonymous 
      ? "匿名用户" 
      : `用户 ${ctx.from.firstName || ""} ${ctx.from.lastName || ""} (@${ctx.from.username || "无用户名"})`;
    
    const reviewMessage = await bot.api.sendPhoto({
      chat_id: REVIEW_GROUP_ID,
      photo: submission.photoFileId,
      caption: `📝 ${formatCaptionForTelegram(submission.caption)}\n\n👤 来自：${fromText}`,
    });
    
    await bot.api.editMessageReplyMarkup({
      chat_id: REVIEW_GROUP_ID,
      message_id: reviewMessage.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ 批准", callback_data: `review_approve_${reviewMessage.message_id}` },
            { text: "❌ 拒绝", callback_data: `review_reject_${reviewMessage.message_id}` }
          ]
        ]
      }
    });
    
    submission.reviewMessageId = reviewMessage.message_id;
    await valkeyClient.setSubmissionByReviewId(reviewMessage.message_id, submission);
    await valkeyClient.deleteSubmission(userId);
    
    await ctx.editText("✅ 已提交审核，请等待管理员审核。");
    await ctx.answerCallbackQuery({ text: "已提交审核" });
  });
  
  bot.callbackQuery(/^review_(approve|reject)_(\d+)$/, async (ctx) => {
    const action = ctx.queryData[1];
    const reviewMessageId = parseInt(ctx.queryData[2]);
    
    if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
      await ctx.answerCallbackQuery({ text: "⛔ 你没有权限操作！" });
      return;
    }
    
    const submission = await valkeyClient.getSubmissionByReviewId(reviewMessageId);
    if (!submission) {
      await ctx.answerCallbackQuery({ text: "提交信息已过期！" });
      return;
    }
    
    const submitterId = submission.userId;
    
    if (action === "approve") {
      try {
        const res = await bot.api.sendPhoto({
          chat_id: CHANNEL_USERNAME,
          photo: submission.photoFileId,
          caption: `📝 ${formatCaptionForTelegram(submission.caption || "")}\n👤 Via @${submission.username || "匿名"}\n投稿: @FantasticSpoonBot`,
        });
        
        const link = "https://t.me/koimemes/" + res.message_id;

        try {
          const { buffer, filePath } = await downloadTelegramFile(bot, submission.photoFileId);
          const filename = getFilenameFromPath(filePath);
          // API 提交时不带 #
          const normalizedCaption = normalizeCaption(submission.caption || "");
          await kmemeApi.postMeme(normalizedCaption, buffer, filename);
          logger.info("✅ meme 已同步到后端");
        } catch (apiError) {
          logger.error("⚠️ 后端上传失败，但 Telegram 发布成功:", apiError);
        }

        await bot.api.sendMessage({
          chat_id: submitterId,
          text: "🎉 你的 meme 已通过审核并发布到频道！\n" + link
        });
        
        await bot.api.editMessageCaption({
          chat_id: REVIEW_GROUP_ID,
          message_id: reviewMessageId,
          caption: `📝 ${formatCaptionForTelegram(submission.caption || "")}\n\n👤 来自：${submission.isAnonymous ? "匿名用户" : `@${submission.username}`}\n\n✅ 已批准并发布 by @${ctx.from.username || "管理员"}`,
        });
        
        await ctx.answerCallbackQuery({ text: "✅ 已批准并发布" });
      } catch (error) {
        logger.error(error);
        await ctx.answerCallbackQuery({ text: "发布失败，请检查bot权限" });
      }
    } else {
      await bot.api.sendMessage({
        chat_id: submitterId,
        text: "❌ 你的 meme 未通过审核。"
      });
      
      await bot.api.editMessageCaption({
        chat_id: REVIEW_GROUP_ID,
        message_id: reviewMessageId,
        caption: `📝 ${formatCaptionForTelegram(submission.caption || "")}\n\n👤 来自：${submission.isAnonymous ? "匿名用户" : `@${submission.username}`}\n\n❌ 已拒绝 by @${ctx.from.username || "管理员"}`,
      });
      
      await ctx.answerCallbackQuery({ text: "❌ 已拒绝" });
    }
    
    await valkeyClient.deleteSubmissionByReviewId(reviewMessageId);
  });
}