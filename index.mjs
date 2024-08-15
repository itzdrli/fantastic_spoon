import {Bot, GrammyError, HttpError } from "grammy";
import { logger } from "./utils/logger.mjs"
import dotenv from 'dotenv'

import { memes } from "./modules/memes.mjs";
import { randMeme } from "./modules/randMeme.mjs";

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

// bot.use(generateUpdateMiddleware());

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

randMeme().then()
memes().then()

async function checkObjects() {
    try {
        const response = await fetch('https://koishi.itzdrli.com');
        
        if (!response.ok) {
            logger.error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const objectsLength = data.objects.length;
        if (objectsLength === 1700) return
        if (objectsLength % 100 === 0) {
            await bot.api.sendMessage('@itzdtech', 'Koishi plugin market has reached ' + objectsLength.toString() + ' plugins!')
            logger.info('Koishi plugin market has reached ' + objectsLength.toString() + ' plugins!')
            return objectsLength.toString()
        } else return ''
    } catch (error) {
        logger.error('Error fetching data:', error);
    }
}

checkObjects()

setInterval(checkObjects, 6 * 60 * 60 * 1000)

bot.start().then()