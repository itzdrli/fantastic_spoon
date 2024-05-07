import { Telegraf } from 'telegraf'
import { message } from "telegraf/filters"
import dotenv from 'dotenv'

import { logger } from "./utils/logger.mjs"

import { memes } from "./modules/memes.mjs"
import { status } from "./modules/status.mjs"
import { start } from "./modules/start.mjs"
import { inspect } from "./modules/inspect.mjs"

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN
export const bot = new Telegraf(token)

bot.help((ctx) => ctx.reply('Commands\n /status - Get bot status\n'))
// bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))

memes().then()
inspect().then()
start().then()
status().then()

bot.launch().
    then(() => {
      logger.info('Bye!')
    })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
