import { Bot } from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'

import { memes } from "./modules/memes.mjs";

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN

export const bot = new Bot(token);
bot.command("start", (ctx) => ctx.reply("我是 Fantastic Spoon\n向我发送meme图片即可开始投稿",
    { parse_mode: "MarkdownV2" },))
memes().then()

bot.start().then()