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
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    this.client.on("connect", () => {
      logger.info("✅ Valkey connected");
    });

    this.client.on("error", (err) => {
      logger.error("❌ Valkey error:", err);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error("Failed to connect to Valkey:", error);
      throw error;
    }
  }

  async setSubmission(userId: number, data: any): Promise<void> {
    const key = `submission:${userId}`;
    await this.client.set(key, JSON.stringify(data));
  }

  async getSubmission(userId: number): Promise<any | null> {
    const key = `submission:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSubmission(userId: number): Promise<void> {
    const key = `submission:${userId}`;
    await this.client.del(key);
  }

  async setSubmissionByReviewId(reviewMessageId: number, data: any): Promise<void> {
    const key = `review:submission:${reviewMessageId}`;
    await this.client.set(key, JSON.stringify(data));
  }

  async getSubmissionByReviewId(reviewMessageId: number): Promise<any | null> {
    const key = `review:submission:${reviewMessageId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSubmissionByReviewId(reviewMessageId: number): Promise<void> {
    const key = `review:submission:${reviewMessageId}`;
    await this.client.del(key);
  }

  async setReviewMapping(reviewMessageId: number, userId: number): Promise<void> {
    const key = `review:${reviewMessageId}`;
    await this.client.set(key, userId.toString());
  }

  async getReviewMapping(reviewMessageId: number): Promise<number | null> {
    const key = `review:${reviewMessageId}`;
    const data = await this.client.get(key);
    return data ? parseInt(data) : null;
  }

  async deleteReviewMapping(reviewMessageId: number): Promise<void> {
    const key = `review:${reviewMessageId}`;
    await this.client.del(key);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const valkeyClient = new ValkeyClient();
