import { bot } from "../index.mjs"

export async function start() {
    bot.start((ctx) => ctx.reply('This is '))
}