import { PrismaClient } from "@prisma/client";
import { nanoid } from 'nanoid';
import { bot } from "../index.mjs";
import { logger } from "../utils/logger.mjs";

const BASE_URL = 'https://itzdrli.com/';

const prisma = new PrismaClient();

export async function surl() {
  bot.command('surl', async (ctx) => {
    const oUrl = ctx.match;
    if (!oUrl) return ctx.reply('Please provide a URL');
    if (!oUrl.startsWith('http')) return ctx.reply('Please provide a valid URL (including http:// or https://)');

    try {
      const existingUrl = await prisma.url.findFirst({
        where: { longUrl: oUrl },
      });

      if (existingUrl) {
        const shortUrl = `${BASE_URL}${existingUrl.shortId}`;
        return ctx.reply(`This URL is already shortened: ${shortUrl}`);
      }

      let shortId;
      let isUnique = false;
      while (!isUnique) {
        shortId = nanoid(6);
        const existingShortId = await prisma.url.findUnique({
          where: { shortId: shortId },
        });
        if (!existingShortId) isUnique = true;
      }

      await prisma.url.create({
        data: {
          shortId: shortId,
          longUrl: oUrl,
        },
      });

      const shortUrl = `${BASE_URL}${shortId}`;
      ctx.reply(`Shorten URL: ${shortUrl}`);
    } catch (err) {
      logger.error("Error processing URL:", err);
      return ctx.reply('An error occurred while processing the URL');
    }
  });
}
