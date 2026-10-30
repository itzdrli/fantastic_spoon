import Redis from "ioredis";
import { VALKEY_HOST, VALKEY_PORT } from "../config";
import logger from "./logger";

// 未完成的投稿 (等待标题/匿名选择) 一天后过期
const SUBMISSION_TTL = 60 * 60 * 24;
// 待审核的投稿保留 30 天
const REVIEW_TTL = 60 * 60 * 24 * 30;

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

	private async getJson<T>(key: string): Promise<T | null> {
		const data = await this.client.get(key);
		return data ? (JSON.parse(data) as T) : null;
	}

	// GETDEL 是原子操作: 并发点击时只有一个请求能拿到数据
	private async takeJson<T>(key: string): Promise<T | null> {
		const data = await this.client.getdel(key);
		return data ? (JSON.parse(data) as T) : null;
	}

	async setSubmission<T>(submissionId: string, data: T): Promise<void> {
		await this.client.set(`submission:${submissionId}`, JSON.stringify(data), "EX", SUBMISSION_TTL);
	}

	async getSubmission<T>(submissionId: string): Promise<T | null> {
		return this.getJson<T>(`submission:${submissionId}`);
	}

	async takeSubmission<T>(submissionId: string): Promise<T | null> {
		return this.takeJson<T>(`submission:${submissionId}`);
	}

	// 记录用户当前等待标题的投稿
	async setAwaitingCaption(userId: number, submissionId: string): Promise<void> {
		await this.client.set(`awaiting-caption:${userId}`, submissionId, "EX", SUBMISSION_TTL);
	}

	async takeAwaitingCaption(userId: number): Promise<string | null> {
		return this.client.getdel(`awaiting-caption:${userId}`);
	}

	async setSubmissionByReviewId<T>(reviewMessageId: number, data: T): Promise<void> {
		await this.client.set(
			`review:submission:${reviewMessageId}`,
			JSON.stringify(data),
			"EX",
			REVIEW_TTL,
		);
	}

	async takeSubmissionByReviewId<T>(reviewMessageId: number): Promise<T | null> {
		return this.takeJson<T>(`review:submission:${reviewMessageId}`);
	}

	/** 在 ttlSeconds 内第一次调用返回 true, 之后返回 false */
	async acquire(key: string, ttlSeconds: number): Promise<boolean> {
		return (await this.client.set(`lock:${key}`, "1", "EX", ttlSeconds, "NX")) === "OK";
	}

	async disconnect(): Promise<void> {
		await this.client.quit();
	}
}

export const valkeyClient = new ValkeyClient();
