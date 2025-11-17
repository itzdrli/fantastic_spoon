import { Bot } from "gramio";
import logger from "./logger";

export async function downloadTelegramFile(
  bot: Bot,
  fileId: string
): Promise<{ buffer: Buffer; filePath: string }> {
  try {
    // 获取文件信息
    const file = await bot.api.getFile({ file_id: fileId });
    
    if (!file.file_path) {
      throw new Error("Failed fetching file path");
    }

    // 构建下载 URL
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    logger.info(`📥 Downloading: ${file.file_path}`);

    // 下载文件
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Download Failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info(`✅ Downloaded, size: ${buffer.length} bytes`);

    return {
      buffer,
      filePath: file.file_path,
    };
  } catch (error) {
    logger.error("❌ Download Failed:", error);
    throw error;
  }
}

export function getFilenameFromPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "image.jpg";
}
