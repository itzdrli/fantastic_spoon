import { Bot, GrammyError, HttpError } from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'
import { generateUpdateMiddleware } from "telegraf-middleware-console-time";

import { memes } from "./modules/memes.mjs";

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN

export const bot = new Bot(token);

bot.catch((err) => {
    const ctx = err.ctx
    logger.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        logger.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        logger.error("Could not contact Telegram:", e);
    } else {
        logger.error("Unknown error:", e);
    }
})

bot.use(generateUpdateMiddleware());

bot.command("start", (ctx) => ctx.reply("我是 Fantastic Spoon\n向我发送meme图片即可开始投稿",
    { parse_mode: "MarkdownV2" },))
memes().then()

bot.start().then()