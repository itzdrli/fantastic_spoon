import { bot } from "../index.mjs";
import sharp from "sharp"
import fs from "fs"
import { logger } from "./logger.mjs";

export async function downloadAndProcessImage(fileId, title) {
    try {
        const pathResponse = await bot.api.getFile(fileId);
        const filePath = `https://api.telegram.org/file/bot${bot.token}/${pathResponse.file_path}`;

        const response = await fetch(filePath);
        const imageData = await response.arrayBuffer()

        const webpBuffer = await sharp(imageData)
            .webp()
            .toBuffer()

        const outputFilePath = `/home/dev/koishi-meme/public/meme/${title}.webp`;
        fs.writeFileSync(outputFilePath, webpBuffer);
        logger.info(`Successfully saved image - ${fileId} as ${title}.webp`)
    } catch (e) {
        logger.error("Error while trying to save the meme:", e)
    }
}