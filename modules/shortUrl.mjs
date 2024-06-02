import express from "express"
import { PrismaClient } from "@prisma/client"
import { nanoid } from 'nanoid'
import { bot } from "../index.mjs"
import { logger } from "../utils/logger.mjs"

const app = express()
const BASE_URL = 'https://itzdrli.com/'

export async function surl() {
  bot.command('surl', async (ctx) => {
    const message = ctx.match
    await ctx.reply(message)
    logger.info(message)
  })
}
