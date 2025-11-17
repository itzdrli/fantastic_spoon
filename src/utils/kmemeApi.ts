import ky from "ky";
import logger from "./logger";

import { data, meme } from "../commands/randMeme";

const BASE_URL = "https://kmeme.itzdrli.cc";

interface SignInResponse {
  token: string;
}

class KMemeAPI {
  private token: string | null = null;
  private username: string;
  private password: string;

  constructor() {
    this.username = process.env.KMEME_USERNAME || "";
    this.password = process.env.KMEME_PASSWORD || "";
  }

  async signIn(): Promise<void> {
    try {
      const response = await ky.post(`${BASE_URL}/auth/sign-in`, {
        json: {
          username: this.username,
          password: this.password,
        },
      }).json<SignInResponse>();

      this.token = response.token;
      logger.info("✅ Sign In Success");
    } catch (error) {
      logger.error("❌ Sign In Failed:", error);
      throw error;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.token) {
      await this.signIn();
    }
  }

  async postMeme(title: string, imageBuffer: Buffer, filename: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", new Blob([new Uint8Array(imageBuffer)]), filename);

      const res = await ky.post(`${BASE_URL}/meme/post`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }).json<data>();
      logger.info("✅ meme Posted with id: ", res.data.id);
    } catch (error) {
      logger.error("❌ Failed to post meme:", error);
      
      if (error instanceof Error && error.message.includes("401")) {
        logger.info("🔄 Token Expired, retrying...");
        this.token = null;
        await this.ensureAuthenticated();
        
        const formData = new FormData();
        formData.append("title", title);
        formData.append("file", new Blob([new Uint8Array(imageBuffer)]), filename);

        await ky.post(`${BASE_URL}/meme/post`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          body: formData,
        });
        
        logger.info("✅ meme Posted");
      } else {
        throw error;
      }
    }
  }
}

export const kmemeApi = new KMemeAPI();
