import {Bot, GrammyError, HttpError, InputFile} from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'
import { generateUpdateMiddleware } from "telegraf-middleware-console-time";

import { shortUrlServer } from "./utils/shortUrlServer.mjs";
import { memes } from "./modules/memes.mjs";
import { surl } from "./modules/shortUrl.mjs";
import { randMeme } from "./modules/randMeme.mjs";

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN

shortUrlServer().then()

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

bot.command("help", (ctx) => ctx.reply(`
/meme - random meme from meems.none.bot (koishi memes)
/surl <url> - shorten a URL
`))

bot.command("start", (ctx) => ctx.reply(`
I am Fantastic Spoon
A spoon developed by Itz_Dr_Li
Open Sourced on Github: https://github.com/itzdrli/fantastic_spoon

What can I do?
- Send me your meme!
- or /help
`));

surl().then()
randMeme().then()
memes().then()

bot.start().then()