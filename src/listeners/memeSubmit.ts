import { type Bot, MediaUpload } from "gramio";
import imgGen from "../utils/imageGen";
import { kmemeApi } from "../utils/kmemeApi";
import logger from "../utils/logger";
import { downloadTelegramFile, getFilenameFromPath } from "../utils/telegramFile";
import { valkeyClient } from "../utils/valkey";

const REVIEW_GROUP_ID = process.env.REVIEW_GROUP_ID!;
const CHANNEL_USERNAME = "@koimemes";
const ADMIN_IDS = new Set(process.env.ADMIN_IDS?.split(",") ?? []);

interface SubmissionData {
	photoFileId: string;
	caption?: string;
	isAnonymous?: boolean;
	reviewMessageId?: number;
	userId: number;
	username?: string;
	firstName?: string;
	lastName?: string;
}

function normalizeCaption(caption: string): string {
	return caption.replace(/^#\s*/, "").trim();
}

function formatCaptionForTelegram(caption: string): string {
	return `# ${normalizeCaption(caption)}`;
}

function getMimeTypeFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();
	const types: Record<string, string> = {
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		bmp: "image/bmp",
	};
	return types[ext ?? ""] ?? "image/jpeg";
}

function formatSubmitterDisplay(submission: SubmissionData): string {
	if (submission.isAnonymous) return "";
	if (submission.username) return `@${submission.username}`;
	const name = [submission.firstName, submission.lastName].filter(Boolean).join(" ");
	return name || String(submission.userId);
}

const ANON_KEYBOARD = (userId: number) => ({
	inline_keyboard: [
		[
			{ text: "是", callback_data: `anon_yes_${userId}` },
			{ text: "否", callback_data: `anon_no_${userId}` },
			{ text: "取消", callback_data: `anon_cancel_${userId}` },
		],
	],
});

export async function memeSubmit(bot: Bot) {
	// Step 1a: photo with caption
	bot.hears(
		(ctx) => ctx.chat.type === "private" && ctx.attachment?.attachmentType === "photo",
		async (ctx) => {
			const photo = ctx.photo?.[ctx.photo.length - 1];
			if (!photo) return;

			const userId = ctx.from.id;
			const base: Omit<SubmissionData, "caption"> = {
				photoFileId: photo.fileId,
				userId,
				username: ctx.from.username,
				firstName: ctx.from.firstName,
				lastName: ctx.from.lastName,
			};

			if (!ctx.caption) {
				await valkeyClient.setSubmission(userId, base);
				await ctx.send("标题: ");
				return;
			}

			await valkeyClient.setSubmission(userId, { ...base, caption: ctx.caption });
			await ctx.send("是否匿名发布？", { reply_markup: ANON_KEYBOARD(userId) });
		},
	);

	// Step 1b: caption as follow-up text
	bot.hears(
		(ctx) => ctx.chat.type === "private" && !ctx.attachment,
		async (ctx) => {
			const userId = ctx.from.id;
			const submission = (await valkeyClient.getSubmission(userId)) as SubmissionData | null;
			if (!submission || submission.caption) return;

			submission.caption = ctx.text || "";
			await valkeyClient.setSubmission(userId, submission);
			await ctx.send("是否匿名发布？", { reply_markup: ANON_KEYBOARD(userId) });
		},
	);

	// Step 2: anonymous choice
	bot.callbackQuery(/^anon_(yes|no|cancel)_(\d+)$/, async (ctx) => {
		const action = ctx.queryData[1];
		const userId = parseInt(ctx.queryData[2]);

		if (ctx.from.id !== userId) {
			await ctx.answerCallbackQuery({ text: "这不是你的提交！" });
			return;
		}

		const submission = (await valkeyClient.getSubmission(userId)) as SubmissionData | null;
		if (!submission?.caption) {
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

		const fromLabel = submission.isAnonymous
			? "匿名用户"
			: `用户 ${formatSubmitterDisplay(submission)}`;

		const reviewMessage = await bot.api.sendPhoto({
			chat_id: REVIEW_GROUP_ID,
			photo: submission.photoFileId,
			caption: `📝 ${formatCaptionForTelegram(submission.caption)}\n\n👤 来自：${fromLabel}`,
		});

		await bot.api.editMessageReplyMarkup({
			chat_id: REVIEW_GROUP_ID,
			message_id: reviewMessage.message_id,
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "✅ 批准", callback_data: `review_approve_${reviewMessage.message_id}` },
						{ text: "❌ 拒绝", callback_data: `review_reject_${reviewMessage.message_id}` },
					],
				],
			},
		});

		submission.reviewMessageId = reviewMessage.message_id;
		await valkeyClient.setSubmissionByReviewId(reviewMessage.message_id, submission);
		await valkeyClient.deleteSubmission(userId);

		await ctx.editText("✅ 已提交审核，请等待管理员审核。");
		await ctx.answerCallbackQuery({ text: "已提交审核" });
	});

	// Step 3: admin review
	bot.callbackQuery(/^review_(approve|reject)_(\d+)$/, async (ctx) => {
		const action = ctx.queryData[1];
		const reviewMessageId = parseInt(ctx.queryData[2]);

		if (!ADMIN_IDS.has(ctx.from.id.toString())) {
			await ctx.answerCallbackQuery({ text: "⛔ 你没有权限操作！" });
			return;
		}

		const submission = (await valkeyClient.getSubmissionByReviewId(
			reviewMessageId,
		)) as SubmissionData | null;
		if (!submission) {
			await ctx.answerCallbackQuery({ text: "提交信息已过期！" });
			return;
		}

		const { userId: submitterId } = submission;
		const adminTag = ctx.from.username ? `@${ctx.from.username}` : "管理员";
		const captionLine = `📝 ${formatCaptionForTelegram(submission.caption || "")}`;
		const fromLine = `👤 来自：${submission.isAnonymous ? "匿名用户" : formatSubmitterDisplay(submission)}`;

		if (action === "approve") {
			try {
				const { buffer: originalBuffer, filePath } = await downloadTelegramFile(
					bot,
					submission.photoFileId,
				);
				const mimeType = getMimeTypeFromPath(filePath);
				const dataUrl = `data:${mimeType};base64,${originalBuffer.toString("base64")}`;
				const renderedBuffer = await imgGen(dataUrl, submission.caption || "");
				const upload = MediaUpload.buffer(Uint8Array.from(renderedBuffer), "meme-polaroid.png");

				const channelCaption = [
					captionLine,
					`👤 Via ${submission.isAnonymous ? "匿名用户" : formatSubmitterDisplay(submission)}`,
					"",
					"📮 投稿: @FantasticSpoonBot",
				].join("\n");

				const res = await bot.api.sendPhoto({
					chat_id: CHANNEL_USERNAME,
					photo: upload,
					caption: channelCaption,
				});

				await bot.api.sendMessage({
					chat_id: submitterId,
					text: `🎉 你的 meme 已通过审核！\nhttps://t.me/koimemes/${res.message_id}`,
				});

				await bot.api.editMessageCaption({
					chat_id: REVIEW_GROUP_ID,
					message_id: reviewMessageId,
					caption: `${captionLine}\n\n${fromLine}\n\n✅ 已批准并发布 by ${adminTag}`,
				});

				try {
					await kmemeApi.postMeme(
						normalizeCaption(submission.caption || ""),
						originalBuffer,
						getFilenameFromPath(filePath),
					);
					logger.info("✅ meme synced to kmeme");
				} catch (apiError) {
					logger.error("⚠️ kmeme sync failed:", apiError);
				}

				await ctx.answerCallbackQuery({ text: "✅ 已批准并发布" });
			} catch (error) {
				logger.error(error);
				await ctx.answerCallbackQuery({ text: "发布失败，请检查 bot 权限" });
			}
		} else {
			await bot.api.sendMessage({ chat_id: submitterId, text: "❌ 你的 meme 未通过审核。" });
			await bot.api.editMessageCaption({
				chat_id: REVIEW_GROUP_ID,
				message_id: reviewMessageId,
				caption: `${captionLine}\n\n${fromLine}\n\n❌ 已拒绝 by ${adminTag}`,
			});
			await ctx.answerCallbackQuery({ text: "❌ 已拒绝" });
		}

		await valkeyClient.deleteSubmissionByReviewId(reviewMessageId);
	});
}
