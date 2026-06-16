import ky from "ky";
import logger from "./logger";

const BASE_URL = "https://kmeme.itzdrli.cc";

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

class KMemeAPI {
	private token: string | null = null;
	private readonly username: string;
	private readonly password: string;

	constructor() {
		this.username = process.env.KMEME_USERNAME || "";
		this.password = process.env.KMEME_PASSWORD || "";
	}

	private async signIn(): Promise<void> {
		const response = await ky
			.post(`${BASE_URL}/auth/sign-in`, {
				json: { email: this.username, password: this.password },
			})
			.json<SignInResponse>();
		this.token = response.token;
		logger.info("✅ Signed in to kmeme");
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.token) await this.signIn();
	}

	async getRandomMeme(): Promise<Meme> {
		const payload = await ky.get(`${BASE_URL}/meme/rand`).json<MemeResponse>();
		return payload.data;
	}

	async postMeme(title: string, imageBuffer: Buffer, filename: string): Promise<void> {
		await this.ensureAuthenticated();

		const buildForm = () => {
			const form = new FormData();
			form.append("title", title);
			form.append("file", new Blob([new Uint8Array(imageBuffer)]), filename);
			return form;
		};

		try {
			const res = await ky
				.post(`${BASE_URL}/meme/post`, {
					headers: { Authorization: `Bearer ${this.token}` },
					body: buildForm(),
				})
				.json<MemeResponse>();
			logger.info("✅ meme posted, id:", res.data.id);
		} catch (error) {
			if (error instanceof Error && error.message.includes("401")) {
				logger.info("🔄 token expired, re-authenticating...");
				this.token = null;
				await this.ensureAuthenticated();
				await ky.post(`${BASE_URL}/meme/post`, {
					headers: { Authorization: `Bearer ${this.token}` },
					body: buildForm(),
				});
				logger.info("✅ meme posted after re-auth");
			} else {
				throw error;
			}
		}
	}
}

export const kmemeApi = new KMemeAPI();
