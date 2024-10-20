import { InputFile } from "grammy";
import { bot } from "../index.mjs";
import fs from "fs";
import path from "path";

export async function randMeme() {
  bot.command("meme", async (ctx) => {
    const imageFolder = "/home/dev/koishi-meme/public/meme/";
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
}