import ky, { HTTPError } from "ky";
import { KMEME_BASE_URL, KMEME_PASSWORD, KMEME_USERNAME } from "../config";
import logger from "./logger";

export interface Meme {
	id: string;
	title: string;
	imageUrl: string;
	userId: string;
	createdAt: string;
}

interface SignInResponse {
	token: string;
}

interface MemeResponse {
	data: Meme;
}

export class DuplicateTitleError extends Error {
	constructor(title: string) {
		super(`kmeme already has a meme titled "${title}"`);
	}
}

function hasStatus(error: unknown, status: number): boolean {
	return error instanceof HTTPError && error.response.status === status;
}

class KMemeAPI {
	private token: string | null = null;
	// 并发请求共用同一次登录
	private signingIn: Promise<string> | null = null;

	private async signIn(): Promise<string> {
		const response = await ky
			.post(`${KMEME_BASE_URL}/auth/sign-in`, {
				json: { email: KMEME_USERNAME, password: KMEME_PASSWORD },
			})
			.json<SignInResponse>();
		logger.info("✅ Signed in to kmeme");
		return response.token;
	}

	private async getToken(): Promise<string> {
		if (this.token) return this.token;
		this.signingIn ??= this.signIn().finally(() => {
			this.signingIn = null;
		});
		this.token = await this.signingIn;
		return this.token;
	}

	async getRandomMeme(): Promise<Meme | null> {
		try {
			const payload = await ky.get(`${KMEME_BASE_URL}/meme/rand`).json<MemeResponse>();
			return payload.data;
		} catch (error) {
			if (hasStatus(error, 404)) return null;
			throw error;
		}
	}

	async postMeme(title: string, imageBuffer: Buffer, filename: string): Promise<Meme> {
		const post = async () => {
			const form = new FormData();
			form.append("title", title);
			form.append("file", new Blob([new Uint8Array(imageBuffer)]), filename);
			const res = await ky
				.post(`${KMEME_BASE_URL}/meme/post`, {
					headers: { Authorization: `Bearer ${await this.getToken()}` },
					body: form,
				})
				.json<MemeResponse>();
			return res.data;
		};

		try {
			return await post();
		} catch (error) {
			if (hasStatus(error, 409)) throw new DuplicateTitleError(title);
			if (!hasStatus(error, 401)) throw error;
			logger.info("🔄 token expired, re-authenticating...");
			this.token = null;
			return await post();
		}
	}
}

export const kmemeApi = new KMemeAPI();
