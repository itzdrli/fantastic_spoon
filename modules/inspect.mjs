import { bot } from '../index.mjs'

export async function inspect() {
    bot.command('inspect', (ctx) => {
        const userId = ctx.from.id;
        ctx.reply(`UserId: ${userId}`);
    });
}