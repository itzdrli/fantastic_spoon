/**
 * 把审核群里已批准、但 kmeme 里没有的 meme 补传到 kmeme。
 *
 * 数据来源是 Telegram Desktop 导出的审核群记录 (Bot API 读不到历史消息):
 *   审核群 → ⋮ → Export chat history → 勾选 Photos, 格式选 JSON
 *
 * 用法:
 *   bun scripts/backfill-kmeme.ts <导出目录> [--since 2026-06-16] [--apply]
 *
 * 默认只列出要补传的内容; 加 --apply 才会上传。
 * 需要 .env 里的 KMEME_USERNAME / KMEME_PASSWORD (KMEME_BASE_URL 可选)。
 */
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import ky, { HTTPError } from "ky";

const BASE_URL = process.env.KMEME_BASE_URL || "https://kmeme.itzdrli.cc";
// 审核群也是普通群聊, 只看 bot 自己发的审核消息
const BOT_NAME = "FantasticSpoonBot";

interface ExportedMessage {
	id: number;
	type: string;
	date: string;
	from?: string;
	photo?: string;
	text: string | (string | { text: string })[];
}

interface Candidate {
	messageId: number;
	date: string;
	title: string;
	photo: string;
}

function parseArgs() {
	const args = process.argv.slice(2);
	const dir = args.find((a) => !a.startsWith("--"));
	const sinceIndex = args.indexOf("--since");
	const since = sinceIndex >= 0 ? args[sinceIndex + 1] : undefined;
	if (!dir || (sinceIndex >= 0 && !since)) {
		console.error("用法: bun scripts/backfill-kmeme.ts <导出目录> [--since YYYY-MM-DD] [--apply]");
		process.exit(1);
	}
	return { dir, since, apply: args.includes("--apply") };
}

function flattenText(text: ExportedMessage["text"]): string {
	return typeof text === "string" ? text : text.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

/**
 * 审核消息格式: "📝 # 标题\n\n👤 来自：...\n\n✅ 已批准并发布 by ..."
 * 早期版本标题前没有 "#"
 */
function parseApproved(message: ExportedMessage): Candidate | null {
	if (message.type !== "message" || !message.photo || message.from !== BOT_NAME) return null;
	const text = flattenText(message.text);
	if (!text.includes("✅ 已批准")) return null;
	const title = text.split("\n")[0]?.match(/^📝\s*(?:#\s*)?(.+)$/)?.[1]?.trim();
	if (!title) return null;
	return { messageId: message.id, date: message.date, title, photo: message.photo };
}

async function main() {
	const { dir, since, apply } = parseArgs();
	const exported = JSON.parse(await readFile(join(dir, "result.json"), "utf8")) as {
		name?: string;
		messages: ExportedMessage[];
	};

	const approved = exported.messages
		.map(parseApproved)
		.filter((c): c is Candidate => c !== null)
		.filter((c) => !since || c.date >= since);

	const { data: existing } = await ky.get(`${BASE_URL}/meme`).json<{ data: { title: string }[] }>();
	const existingTitles = new Set(existing.map((m) => m.title));

	// 同一标题被批准多次时只补第一张
	const seen = new Set<string>();
	const missing = approved.filter((c) => {
		if (existingTitles.has(c.title) || seen.has(c.title)) return false;
		seen.add(c.title);
		return true;
	});

	console.log(`导出: ${exported.name ?? dir}`);
	console.log(`已批准 ${approved.length} 条${since ? ` (自 ${since})` : ""}, kmeme 已有 ${approved.length - missing.length} 条, 待补 ${missing.length} 条\n`);
	for (const c of missing) console.log(`  ${c.date.slice(0, 10)}  #${c.messageId}  ${c.title}`);

	if (!apply) {
		if (missing.length) console.log("\n预览模式, 加 --apply 上传");
		return;
	}
	if (!missing.length) return;

	const { token } = await ky
		.post(`${BASE_URL}/auth/sign-in`, {
			json: { email: process.env.KMEME_USERNAME, password: process.env.KMEME_PASSWORD },
		})
		.json<{ token: string }>();

	let ok = 0;
	for (const c of missing) {
		const form = new FormData();
		form.append("title", c.title);
		form.append("file", new Blob([await readFile(join(dir, c.photo))]), basename(c.photo));
		try {
			await ky.post(`${BASE_URL}/meme/post`, { headers: { Authorization: `Bearer ${token}` }, body: form });
			ok++;
			console.log(`✅ ${c.title}`);
		} catch (error) {
			const reason = error instanceof HTTPError ? `${error.response.status} ${await error.response.text()}` : error;
			console.log(`❌ ${c.title}: ${reason}`);
		}
	}
	console.log(`\n完成: ${ok}/${missing.length}`);
}

await main();
