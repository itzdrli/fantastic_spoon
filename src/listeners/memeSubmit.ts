import { randomUUID } from "node:crypto";
import { type Bot, MediaUpload } from "gramio";
import {
	ADMIN_IDS,
	BOT_USERNAME,
	CHANNEL,
	KMEME_PASSWORD,
	KMEME_USERNAME,
	REVIEW_GROUP_ID,
} from "../config";
import imgGen from "../utils/imageGen";
import { DuplicateTitleError, kmemeApi } from "../utils/kmemeApi";
import logger from "../utils/logger";
import { downloadTelegramFile, getFilenameFromPath } from "../utils/telegramFile";
import { valkeyClient } from "../utils/valkey";

const CAPTION_MAX_LENGTH = 50;

interface SubmissionData {
	id: string;
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

/** 返回错误提示, 合法时返回 null */
function validateCaption(caption: string): string | null {
	const normalized = normalizeCaption(caption);
	if (!normalized) return "标题不能为空，请重新发送标题:";
	if ([...normalized].length > CAPTION_MAX_LENGTH) {
		return `标题最多 ${CAPTION_MAX_LENGTH} 个字，请重新发送标题:`;
	}
	return null;
}

function formatSubmitterDisplay(submission: SubmissionData): string {
	if (submission.isAnonymous) return "匿名用户";
	if (submission.username) return `@${submission.username}`;
	const name = [submission.firstName, submission.lastName].filter(Boolean).join(" ");
	return name || String(submission.userId);
}

/** 执行可失败的附带操作, 失败只记日志 */
async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
	try {
		return await fn();
	} catch (error) {
		logger.error(`${label}:`, error);
		return undefined;
	}
}

const ANON_KEYBOARD = (submissionId: string) => ({
	inline_keyboard: [
		[
			{ text: "是", callback_data: `anon_yes_${submissionId}` },
			{ text: "否", callback_data: `anon_no_${submissionId}` },
			{ text: "取消", callback_data: `anon_cancel_${submissionId}` },
		],
	],
});

const REVIEW_KEYBOARD = {
	inline_keyboard: [
		[
			{ text: "✅ 批准", callback_data: "review_approve" },
			{ text: "❌ 拒绝", callback_data: "review_reject" },
		],
	],
};

async function syncToKmeme(submission: SubmissionData, buffer: Buffer, filePath: string) {
	if (!KMEME_USERNAME || !KMEME_PASSWORD) return "⚠️ kmeme 未配置，未同步";
	try {
		await kmemeApi.postMeme(
			normalizeCaption(submission.caption || ""),
			buffer,
			getFilenameFromPath(filePath),
		);
		logger.info("✅ meme synced to kmeme");
		return "🔄 已同步到 kmeme";
	} catch (error) {
		if (error instanceof DuplicateTitleError) return "⚠️ kmeme 未同步：标题重复";
		logger.error("⚠️ kmeme sync failed:", error);
		return "⚠️ kmeme 同步失败";
	}
}

export function memeSubmit(bot: Bot) {
	// Step 1a: photo, with or without caption
	bot.hears(
		(ctx) => ctx.chat.type === "private" && ctx.attachment?.attachmentType === "photo",
		async (ctx) => {
			const photo = ctx.photo?.[ctx.photo.length - 1];
			if (!photo) return;

			if (ctx.mediaGroupId) {
				// 相册的每张图都是单独的消息, 只回复一次
				if (await valkeyClient.acquire(`media-group:${ctx.mediaGroupId}`, 60)) {
					await ctx.send("暂不支持相册投稿，请一张一张发送");
				}
				return;
			}

			const submission: SubmissionData = {
				id: randomUUID(),
				photoFileId: photo.fileId,
				userId: ctx.from.id,
				username: ctx.from.username,
				firstName: ctx.from.firstName,
				lastName: ctx.from.lastName,
			};

			const captionError = ctx.caption ? validateCaption(ctx.caption) : "标题: ";
			if (captionError) {
				await valkeyClient.setSubmission(submission.id, submission);
				await valkeyClient.setAwaitingCaption(submission.userId, submission.id);
				await ctx.send(captionError);
				return;
			}

			submission.caption = ctx.caption;
			// 之前没写标题的投稿作废, 免得后面的消息被当成它的标题
			await valkeyClient.takeAwaitingCaption(submission.userId);
			await valkeyClient.setSubmission(submission.id, submission);
			await ctx.send("是否匿名发布？", { reply_markup: ANON_KEYBOARD(submission.id) });
		},
	);

	// Step 1b: caption as follow-up text
	bot.hears(
		(ctx) => ctx.chat.type === "private" && !ctx.attachment && !!ctx.text && !ctx.text.startsWith("/"),
		async (ctx) => {
			const userId = ctx.from.id;
			const submissionId = await valkeyClient.takeAwaitingCaption(userId);
			if (!submissionId) return;
			const submission = await valkeyClient.getSubmission<SubmissionData>(submissionId);
			if (!submission) return;

			const captionError = validateCaption(ctx.text || "");
			if (captionError) {
				await valkeyClient.setAwaitingCaption(userId, submissionId);
				await ctx.send(captionError);
				return;
			}

			submission.caption = ctx.text;
			await valkeyClient.setSubmission(submissionId, submission);
			await ctx.send("是否匿名发布？", { reply_markup: ANON_KEYBOARD(submissionId) });
		},
	);

	// 其它附件
	bot.hears(
		(ctx) => ctx.chat.type === "private" && !!ctx.attachment && ctx.attachment.attachmentType !== "photo",
		async (ctx) => {
			const isImageFile =
				ctx.attachment?.attachmentType === "document" &&
				ctx.document?.mimeType?.startsWith("image/");
			await ctx.send(isImageFile ? "请以图片（而不是文件）的形式发送" : "目前只支持图片投稿");
		},
	);

	// Step 2: anonymous choice
	bot.callbackQuery(/^anon_(yes|no|cancel)_([\w-]+)$/, async (ctx) => {
		const action = ctx.queryData[1];
		const submissionId = ctx.queryData[2];

		// 原子取出, 重复点击只有第一次生效
		const submission = await valkeyClient.takeSubmission<SubmissionData>(submissionId);
		if (!submission) {
			await ctx.answerCallbackQuery({ text: "投稿已失效，请重新发送图片" });
			return;
		}

		if (ctx.from.id !== submission.userId) {
			await valkeyClient.setSubmission(submissionId, submission);
			await ctx.answerCallbackQuery({ text: "这不是你的提交！" });
			return;
		}

		if (!submission.caption) {
			await valkeyClient.setSubmission(submissionId, submission);
			await ctx.answerCallbackQuery({ text: "提交信息不完整！" });
			return;
		}

		if (action === "cancel") {
			await safely("edit anon prompt", async () => {
				await ctx.editText("已取消提交。");
			});
			await ctx.answerCallbackQuery({ text: "已取消" });
			return;
		}

		submission.isAnonymous = action === "yes";

		let reviewMessageId: number;
		try {
			const reviewMessage = await bot.api.sendPhoto({
				chat_id: REVIEW_GROUP_ID,
				photo: submission.photoFileId,
				caption: `📝 ${formatCaptionForTelegram(submission.caption)}\n\n👤 来自：${formatSubmitterDisplay(submission)}`,
				reply_markup: REVIEW_KEYBOARD,
			});
			reviewMessageId = reviewMessage.message_id;
		} catch (error) {
			logger.error("send to review group failed:", error);
			await valkeyClient.setSubmission(submissionId, submission);
			await ctx.answerCallbackQuery({ text: "提交失败，请稍后重试", show_alert: true });
			return;
		}

		submission.reviewMessageId = reviewMessageId;
		await valkeyClient.setSubmissionByReviewId(reviewMessageId, submission);

		await safely("edit anon prompt", async () => {
			await ctx.editText("✅ 已提交审核，请等待管理员审核。");
		});
		await ctx.answerCallbackQuery({ text: "已提交审核" });
	});

	// Step 3: admin review
	// 旧版按钮的 callback_data 带 message id, 新版直接取按钮所在消息
	bot.callbackQuery(/^review_(approve|reject)(?:_(\d+))?$/, async (ctx) => {
		const action = ctx.queryData[1];
		const reviewMessageId = ctx.message?.id ?? Number(ctx.queryData[2]);

		if (!ADMIN_IDS.has(ctx.from.id.toString())) {
			await ctx.answerCallbackQuery({ text: "⛔ 你没有权限操作！" });
			return;
		}

		// 原子取出, 防止多个管理员同时操作导致重复发布
		const submission = await valkeyClient.takeSubmissionByReviewId<SubmissionData>(reviewMessageId);
		if (!submission) {
			await ctx.answerCallbackQuery({ text: "该投稿已处理或已过期" });
			return;
		}

		const { userId: submitterId } = submission;
		const adminTag = ctx.from.username ? `@${ctx.from.username}` : "管理员";
		const captionLine = `📝 ${formatCaptionForTelegram(submission.caption || "")}`;
		const fromLine = `👤 来自：${formatSubmitterDisplay(submission)}`;

		if (action === "reject") {
			await safely("edit review caption", async () => {
				await bot.api.editMessageCaption({
					chat_id: REVIEW_GROUP_ID,
					message_id: reviewMessageId,
					caption: `${captionLine}\n\n${fromLine}\n\n❌ 已拒绝 by ${adminTag}`,
				});
			});
			await safely("notify submitter", () =>
				bot.api.sendMessage({ chat_id: submitterId, text: "❌ 你的 meme 未通过审核。" }),
			);
			await safely("answer callback", () => ctx.answerCallbackQuery({ text: "❌ 已拒绝" }));
			return;
		}

		let originalBuffer: Buffer;
		let filePath: string;
		let channelMessageId: number;
		try {
			({ buffer: originalBuffer, filePath } = await downloadTelegramFile(bot, submission.photoFileId));
			const renderedBuffer = await imgGen(originalBuffer, submission.caption || "");
			const upload = MediaUpload.buffer(Uint8Array.from(renderedBuffer), "meme-polaroid.jpg");

			const res = await bot.api.sendPhoto({
				chat_id: `@${CHANNEL}`,
				photo: upload,
				caption: [captionLine, `👤 Via ${formatSubmitterDisplay(submission)}`, "", `📮 投稿: @${BOT_USERNAME}`].join(
					"\n",
				),
			});
			channelMessageId = res.message_id;
		} catch (error) {
			logger.error("publish failed:", error);
			// 放回去, 管理员可以重试
			await valkeyClient.setSubmissionByReviewId(reviewMessageId, submission);
			await safely("answer callback", () =>
				ctx.answerCallbackQuery({ text: "发布失败，请检查 bot 权限后重试", show_alert: true }),
			);
			return;
		}

		// 频道已发布, 以下步骤失败都不影响结果
		const syncStatus = await syncToKmeme(submission, originalBuffer, filePath);
		await safely("edit review caption", async () => {
			await bot.api.editMessageCaption({
				chat_id: REVIEW_GROUP_ID,
				message_id: reviewMessageId,
				caption: `${captionLine}\n\n${fromLine}\n\n✅ 已批准并发布 by ${adminTag}\n${syncStatus}`,
			});
		});
		await safely("notify submitter", () =>
			bot.api.sendMessage({
				chat_id: submitterId,
				text: `🎉 你的 meme 已通过审核！\nhttps://t.me/${CHANNEL}/${channelMessageId}`,
			}),
		);
		await safely("answer callback", () => ctx.answerCallbackQuery({ text: "✅ 已批准并发布" }));
	});
}
