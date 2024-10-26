import {Bot, GrammyError, HttpError } from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'

import { memes } from "./modules/memes.mjs";
import { randMeme } from "./modules/randMeme.mjs";

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN


export const bot = new Bot(token);

bot.command("help", (ctx) => ctx.reply(`
/meme - random meme from meems.none.bot (koishi memes)
`))

bot.command("start", (ctx) => ctx.reply(`
I am Fantastic Spoon
A spoon developed by Itz_Dr_Li
Open Sourced on Github: https://github.com/itzdrli/fantastic_spoon

What can I do?
- Send me your meme!
- or /help
`));

randMeme().then()
memes().then()

bot.start().then()