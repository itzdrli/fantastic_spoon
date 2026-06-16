import { type Bot, MediaUpload } from "gramio";
import imgGen from "../utils/imageGen";
import { kmemeApi } from "../utils/kmemeApi";
import logger from "../utils/logger";

const BASE_URL = "https://kmeme.itzdrli.cc";

export async function randMeme(bot: Bot) {
	bot.command("meme", async (ctx) => {
		logger.info("/meme requested", { userId: ctx.from.id });
		try {
			await ctx.sendChatAction("upload_photo");
			const meme = await kmemeApi.getRandomMeme();
			if (!meme) {
				await ctx.send("暂时没有 meme，稍后再试");
				return;
			}

			const imgBuffer = await imgGen(BASE_URL + meme.imageUrl, meme.title);
			const upload = MediaUpload.buffer(Uint8Array.from(imgBuffer), "meme-polaroid.png");
			await ctx.sendPhoto(upload, {});
		} catch (error) {
			logger.error(`randMeme: ${error}`);
			await ctx.send("抱歉，meme 生成失败，请稍后重试。");
		}
	});
}
