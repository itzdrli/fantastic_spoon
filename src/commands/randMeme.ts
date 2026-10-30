import { type Bot, MediaUpload } from "gramio";
import { KMEME_BASE_URL } from "../config";
import imgGen from "../utils/imageGen";
import { kmemeApi } from "../utils/kmemeApi";
import logger from "../utils/logger";
import { valkeyClient } from "../utils/valkey";

// 每个用户两次 /meme 之间的最小间隔 (秒)
const COOLDOWN = 10;

export function randMeme(bot: Bot) {
	bot.command("meme", async (ctx) => {
		const userId = ctx.from?.id;
		if (!userId) return;
		if (!(await valkeyClient.acquire(`meme-cooldown:${userId}`, COOLDOWN))) {
			await ctx.send(`太快了，${COOLDOWN} 秒后再试`);
			return;
		}

		logger.info("/meme requested", { userId });
		try {
			await ctx.sendChatAction("upload_photo");
			const meme = await kmemeApi.getRandomMeme();
			if (!meme) {
				await ctx.send("暂时没有 meme，稍后再试");
				return;
			}

			const imgBuffer = await imgGen(new URL(meme.imageUrl, KMEME_BASE_URL).href, meme.title);
			const upload = MediaUpload.buffer(Uint8Array.from(imgBuffer), "meme-polaroid.jpg");
			await ctx.sendPhoto(upload, {});
		} catch (error) {
			logger.error("randMeme failed:", error);
			await ctx.send("抱歉，meme 生成失败，请稍后重试。");
		}
	});
}
