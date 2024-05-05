import winston from 'winston'
import { Telegraf } from 'telegraf'
import { message } from "telegraf/filters"
import dotenv from 'dotenv'
import { status } from "./modules/status.mjs"

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'MM-DD HH:mm:ss' }),
    winston.format.printf(info => `[${info.level}][${info.timestamp}] ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'latest.log', level: 'info' }),
  ]
});

dotenv.config({ path: `./.env` });
const token = process.env.TG_TOKEN
export const bot = new Telegraf(token)

bot.start((ctx) => ctx.reply('Hey!'))
bot.help((ctx) => ctx.reply('Commands\n /status - Get bot status\n'))
bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.command('leave', async (ctx) => {
  ctx.reply('Bye')
  await ctx.telegram.leaveChat(ctx.message.chat.id)
  await ctx.leaveChat()
})
status()
bot.launch().
    then(() => {
      logger.info('Bye!')
    })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
