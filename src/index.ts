import { Bot } from "gramio";
import "dotenv/config";

import { randMeme } from "./commands/randMeme";
import { memeSubmit } from "./listeners/memeSubmit";
import logger from "./utils/logger";
import { valkeyClient } from "./utils/valkey";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => ctx.send("Hello"));

bot.command("id", async (ctx) => {
	const lines = [
		"📋 **聊天信息**",
		`🆔 Chat ID: \`${ctx.chat.id}\``,
		`📝 Chat Type: ${ctx.chat.type}`,
		...(ctx.chat.title ? [`📛 Chat Title: ${ctx.chat.title}`] : []),
		"",
		"👤 **你的信息**",
		`🆔 Your ID: \`${ctx.from.id}\``,
		`👤 Name: ${ctx.from.firstName || ""} ${ctx.from.lastName || ""}`.trim(),
		...(ctx.from.username ? [`🔗 Username: @${ctx.from.username}`] : []),
	];
	await ctx.send(lines.join("\n"), { parse_mode: "Markdown" });
});

await valkeyClient.connect().catch((err) => {
	logger.error("Failed to connect to Valkey:", err);
	process.exit(1);
});

randMeme(bot);
memeSubmit(bot);
bot.start();
logger.info("🚀 Bot online");

export default bot;
