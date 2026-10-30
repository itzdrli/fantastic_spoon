import type { Bot } from "gramio";
import { BOT_TOKEN, TELEGRAM_API_URL } from "../config";
import logger from "./logger";

const DOWNLOAD_TIMEOUT = 30_000;

export async function downloadTelegramFile(
	bot: Bot,
	fileId: string,
): Promise<{ buffer: Buffer; filePath: string }> {
	const file = await bot.api.getFile({ file_id: fileId });
	if (!file.file_path) {
		throw new Error("Failed fetching file path");
	}

	logger.info(`📥 Downloading: ${file.file_path}`);

	// 注意: 这个 URL 含 bot token, 不要打进日志
	const response = await fetch(`${TELEGRAM_API_URL}/file/bot${BOT_TOKEN}/${file.file_path}`, {
		signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
	});
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status} ${response.statusText}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	logger.info(`✅ Downloaded, size: ${buffer.length} bytes`);

	return { buffer, filePath: file.file_path };
}

export function getFilenameFromPath(filePath: string): string {
	const parts = filePath.split("/");
	return parts[parts.length - 1] || "image.jpg";
}
