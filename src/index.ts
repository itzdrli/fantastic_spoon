import { Bot } from "gramio";

import { randMeme } from "./commands/randMeme";
import { BOT_TOKEN, TELEGRAM_API_URL } from "./config";
import { memeSubmit } from "./listeners/memeSubmit";
import logger from "./utils/logger";
import { valkeyClient } from "./utils/valkey";

const bot = new Bot(BOT_TOKEN, { api: { baseURL: `${TELEGRAM_API_URL}/bot` } });

bot.onError(async ({ context, kind, error }) => {
	logger.error(`Unhandled ${kind} error:`, error);
	// 避免按钮一直转圈
	if (context.is("callback_query")) {
		await context.answerCallbackQuery({ text: "出错了，请稍后重试" }).catch(() => {});
	}
});

bot.command("start", (ctx) => ctx.send("投稿: 直接把图片丢给我"));

bot.command("id", async (ctx) => {
	// 纯文本发送: 用户名/群名里的 _ * 等字符会让 Markdown 解析失败
	const lines = [
		"📋 聊天信息",
		`🆔 Chat ID: ${ctx.chat.id}`,
		`📝 Chat Type: ${ctx.chat.type}`,
		...(ctx.chat.title ? [`📛 Chat Title: ${ctx.chat.title}`] : []),
		...(ctx.from
			? [
					"",
					"👤 你的信息",
					`🆔 Your ID: ${ctx.from.id}`,
					`👤 Name: ${ctx.from.firstName || ""} ${ctx.from.lastName || ""}`.trim(),
					...(ctx.from.username ? [`🔗 Username: @${ctx.from.username}`] : []),
				]
			: []),
	];
	await ctx.send(lines.join("\n"));
});

await valkeyClient.connect().catch((err) => {
	logger.error("Failed to connect to Valkey:", err);
	process.exit(1);
});

randMeme(bot);
memeSubmit(bot);

await bot.start();
logger.info("🚀 Bot online");

async function shutdown(signal: string) {
	logger.info(`${signal} received, shutting down`);
	await bot.stop().catch(() => {});
	await valkeyClient.disconnect().catch(() => {});
	process.exit(0);
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

export default bot;
