import {Bot, GrammyError, HttpError, InputFile} from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'
import { generateUpdateMiddleware } from "telegraf-middleware-console-time";
import fs from "fs";
import path from "path";

import { memes } from "./modules/memes.mjs";
import { surl } from "./modules/shortUrl.mjs";

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

bot.command("meme", async (ctx) => {
    const imageFolder = "/home/dev/koishi-meme/meme/";
    const files = fs.readdirSync(imageFolder);
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const photo = new InputFile(path.join(imageFolder, randomFile));
    const caption = randomFile.replace(/\.(png|jpg|jpeg|webp)$/i, '')
    if (ctx.chat.type === "private") {
        await ctx.api.sendPhoto(ctx.from.id.toString(), photo, {
            caption: "# " + caption
        })
    } else {
        await ctx.replyWithPhoto(
            photo,
            {
                caption: "# " + caption
            }
        )
    }
});

bot.command("help", (ctx) => ctx.reply(`
/meme - random meme from meems.none.bot (koishi memes)
`))

bot.command("start", (ctx) => ctx.reply(`
I am Fantastic Spoon
A spoon developed by Itz_Dr_Li
Open Sourced on Github: https://github.com/itzdrli/fantastic_spoon

What can I do?
- Send me your meme!
- or do /meme to get a random meme
`));

memes().then()
surl().then()

bot.start().then()