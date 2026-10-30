function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required env: ${name}`);
	return value;
}

export const BOT_TOKEN = required("BOT_TOKEN");
// 使用自建 Bot API server 时可覆盖
export const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
export const REVIEW_GROUP_ID = required("REVIEW_GROUP_ID");
export const ADMIN_IDS = new Set(
	required("ADMIN_IDS")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean),
);

export const KMEME_BASE_URL = process.env.KMEME_BASE_URL || "https://kmeme.itzdrli.cc";
export const KMEME_USERNAME = process.env.KMEME_USERNAME ?? "";
export const KMEME_PASSWORD = process.env.KMEME_PASSWORD ?? "";

export const CHANNEL = "koimemes";
export const BOT_USERNAME = "FantasticSpoonBot";

export const VALKEY_HOST = process.env.VALKEY_HOST || "localhost";
export const VALKEY_PORT = parseInt(process.env.VALKEY_PORT || "6379", 10);
