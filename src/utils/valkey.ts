import Redis from "ioredis";
import logger from "./logger";

const VALKEY_HOST = process.env.VALKEY_HOST || "localhost";
const VALKEY_PORT = parseInt(process.env.VALKEY_PORT || "6379");

class ValkeyClient {
	private client: Redis;

	constructor() {
		this.client = new Redis({
			host: VALKEY_HOST,
			port: VALKEY_PORT,
			retryStrategy: (times) => Math.min(times * 50, 2000),
			lazyConnect: true,
		});

		this.client.on("connect", () => logger.info("✅ Valkey connected"));
		this.client.on("error", (err) => logger.error("❌ Valkey error:", err));
	}

	async connect(): Promise<void> {
		await this.client.connect();
	}

	async setSubmission(userId: number, data: unknown): Promise<void> {
		await this.client.set(`submission:${userId}`, JSON.stringify(data));
	}

	async getSubmission(userId: number): Promise<unknown | null> {
		const data = await this.client.get(`submission:${userId}`);
		return data ? JSON.parse(data) : null;
	}

	async deleteSubmission(userId: number): Promise<void> {
		await this.client.del(`submission:${userId}`);
	}

	async setSubmissionByReviewId(reviewMessageId: number, data: unknown): Promise<void> {
		await this.client.set(`review:submission:${reviewMessageId}`, JSON.stringify(data));
	}

	async getSubmissionByReviewId(reviewMessageId: number): Promise<unknown | null> {
		const data = await this.client.get(`review:submission:${reviewMessageId}`);
		return data ? JSON.parse(data) : null;
	}

	async deleteSubmissionByReviewId(reviewMessageId: number): Promise<void> {
		await this.client.del(`review:submission:${reviewMessageId}`);
	}

	async disconnect(): Promise<void> {
		await this.client.quit();
	}
}

export const valkeyClient = new ValkeyClient();
