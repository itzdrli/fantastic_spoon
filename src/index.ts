import { Bot } from "gramio";
import "dotenv/config";

import logger from "./utils/logger";
import { valkeyClient } from "./utils/valkey";

import { randMeme } from "./commands/randMeme";
import { memeSubmit } from "./listeners/memeSubmit";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => ctx.send("Hello"));

bot.command("id", async (ctx) => {
  const chatInfo = `
📋 **聊天信息**
🆔 Chat ID: \`${ctx.chat.id}\`
📝 Chat Type: ${ctx.chat.type}
${ctx.chat.title ? `📛 Chat Title: ${ctx.chat.title}` : ''}

👤 **你的信息**
🆔 Your ID: \`${ctx.from.id}\`
👤 Name: ${ctx.from.firstName || ''} ${ctx.from.lastName || ''}
${ctx.from.username ? `🔗 Username: @${ctx.from.username}` : ''}
  `.trim();
  
  await ctx.send(chatInfo, { parse_mode: "Markdown" });
});

// 初始化 Valkey 连接
valkeyClient.connect().catch((err) => {
  logger.error("Failed to connect to Valkey:", err);
  process.exit(1);
});

bot.start();
randMeme(bot);
memeSubmit(bot);
logger.info("🚀  Bot Online");

export default bot;
