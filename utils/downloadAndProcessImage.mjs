import { bot } from "../index.mjs";
import sharp from "sharp"
import fs from "fs"
import { logger } from "./logger.mjs";

export async function downloadAndProcessImage(fileId, title) {
    try {
        const pathResponse = await bot.api.getFile(fileId);
        const filePath = `https://api.telegram.org/file/bot${bot.token}/${pathResponse.file_path}`;

        const response = await fetch(filePath);
        const imageData = await response.buffer()

        const webpBuffer = await sharp(imageData)
            .webp()
            .toBuffer()

        const outputFilePath = `/home/dev/koishi-meme/meme/image.webp`;
        fs.writeFileSync(outputFilePath, webpBuffer);
        logger.notice("Successfully saved image")
    } catch (e) {
        logger.error("Error while trying to save the meme:", e)
    }
}