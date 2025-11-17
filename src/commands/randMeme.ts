import ky from "ky";
import { MediaInput, MediaUpload, Bot } from "gramio";

export interface data {
  data: meme;
}

export interface meme {
  id: string;
  title: string;
  imageUrl: string;
  userId: string;
  createdAt: string;
}

const BASE_URL = "https://kmeme.itzdrli.cc";

async function getRandomMeme(): Promise<meme> {
  const payload = await ky.get(`${BASE_URL}/meme/rand`).json<data>();
  return payload?.data;
}

export async function randMeme(bot: Bot) {
  bot.command("meme", async (ctx) => {
    const res = await getRandomMeme();
    await ctx.sendMediaGroup([
      MediaInput.photo(await MediaUpload.url(BASE_URL + res.imageUrl), {
        caption: "# " + res.title,
      }),
    ]);
  });
}
