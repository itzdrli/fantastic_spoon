import { readFileSync } from "node:fs";
import { ImageResponse } from "@takumi-rs/image-response";

const fonts = [
	{
		name: "OPPOSans R",
		data: readFileSync("fonts/OPPOSansRegular.ttf"),
	},
	{
		name: "Noto Color Emoji",
		data: readFileSync("fonts/NotoColorEmoji-Regular.ttf"),
	},
	{
		name: "IBM Plex Sans",
		data: readFileSync("fonts/IBMPlexSans-Regular.ttf"),
	},
];

// Polaroid 内部图片区域的宽度
const IMAGE_AREA_WIDTH = 934;
// 外边距 (p-8 = 32px each side)
const OUTER_PADDING = 64;
// 标题栏: 单行高度 72, 每多一行 +40
const CAPTION_MIN_HEIGHT = 72;
const CAPTION_LINE_HEIGHT = 40;
// text-3xl (30px) 在 894px 宽度内大约能放 28 个全角字符
const CAPTION_UNITS_PER_LINE = 28;
// 最小图片高度
const MIN_IMAGE_HEIGHT = 200;
// Telegram sendPhoto 要求宽 + 高 <= 10000, 留出余量
const MAX_OUTPUT_HEIGHT = 8000;
// 远程图片最大体积
const MAX_REMOTE_IMAGE_SIZE = 20 * 1024 * 1024;
const FETCH_TIMEOUT = 15_000;

// 输出图片宽度
export const OUTPUT_WIDTH = IMAGE_AREA_WIDTH + OUTER_PADDING;

function PolaroidTemplate({
	imageSrc,
	imageWidth,
	imageHeight,
	caption,
	captionHeight,
}: {
	imageSrc: string;
	imageWidth: number;
	imageHeight: number;
	caption: string;
	captionHeight: number;
}) {
	return (
		<div tw="flex flex-col bg-[#2e3440] w-full h-full items-center justify-center p-8">
			<div
				tw="flex flex-col bg-[#5e81ac] shadow-2xl rounded-3xl"
				style={{ width: IMAGE_AREA_WIDTH }}
			>
				<div tw="flex bg-[#2e3440] items-center justify-center rounded-t-3xl">
					<img
						src={imageSrc}
						alt="Submitted meme"
						tw="rounded-t-3xl"
						style={{ width: imageWidth, height: imageHeight }}
					/>
				</div>
				<div
					tw="flex bg-[#4c566a] border-t border-[#434c5e] px-5 items-center justify-center rounded-b-3xl"
					style={{ height: captionHeight }}
				>
					<p tw="text-3xl font-semibold tracking-tight text-[#d8dee9] m-0 text-center">
						# {caption}
					</p>
				</div>
			</div>
		</div>
	);
}

/**
 * 估算标题需要的行数: 全角字符 / emoji 算 1, 其它算 0.55
 */
function estimateCaptionLines(caption: string): number {
	let units = 2; // "# " 前缀
	for (const char of caption) {
		units += (char.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.55;
	}
	return Math.max(1, Math.ceil(units / CAPTION_UNITS_PER_LINE));
}

/**
 * 从 Buffer 获取图片尺寸, 无法识别时返回 null
 */
function getImageDimensionsFromBuffer(buffer: Buffer): { width: number; height: number } | null {
	if (buffer.length < 30) return null;

	// PNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
		return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
	}

	// GIF
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
		return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
	}

	// JPEG: 遍历 segment 找 SOFn (C0-CF, 排除 DHT C4 / JPG C8 / DAC CC)
	if (buffer[0] === 0xff && buffer[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < buffer.length) {
			if (buffer[offset] !== 0xff) return null;
			const marker = buffer[offset + 1];
			// 填充字节
			if (marker === 0xff) {
				offset++;
				continue;
			}
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
				return {
					width: buffer.readUInt16BE(offset + 7),
					height: buffer.readUInt16BE(offset + 5),
				};
			}
			offset += 2 + buffer.readUInt16BE(offset + 2);
		}
		return null;
	}

	// WebP
	if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
		const chunk = buffer.toString("ascii", 12, 16);
		if (chunk === "VP8 ") {
			return {
				width: buffer.readUInt16LE(26) & 0x3fff,
				height: buffer.readUInt16LE(28) & 0x3fff,
			};
		}
		if (chunk === "VP8L") {
			const bits = buffer.readUInt32LE(21);
			return {
				width: (bits & 0x3fff) + 1,
				height: ((bits >> 14) & 0x3fff) + 1,
			};
		}
		if (chunk === "VP8X") {
			return {
				width: buffer.readUIntLE(24, 3) + 1,
				height: buffer.readUIntLE(27, 3) + 1,
			};
		}
	}

	return null;
}

function getMimeType(buffer: Buffer): string {
	if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
	if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
	if (buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
	return "image/jpeg";
}

async function fetchImage(url: string): Promise<Buffer> {
	const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
	if (!response.ok) {
		throw new Error(`Image fetch failed: ${response.status} ${url}`);
	}
	const length = Number(response.headers.get("content-length") ?? 0);
	if (length > MAX_REMOTE_IMAGE_SIZE) {
		throw new Error(`Image too large: ${length} bytes ${url}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

/**
 * 生成拍立得风格的 JPEG
 * @param source 图片 URL 或图片 Buffer
 */
async function imgGen(source: string | Buffer, caption: string) {
	const buffer = typeof source === "string" ? await fetchImage(source) : source;
	const dataUrl = `data:${getMimeType(buffer)};base64,${buffer.toString("base64")}`;

	const dims = getImageDimensionsFromBuffer(buffer);
	const { width: imgWidth, height: imgHeight } =
		dims && dims.width > 0 && dims.height > 0
			? dims
			: { width: IMAGE_AREA_WIDTH, height: IMAGE_AREA_WIDTH };

	caption = caption.trim();
	const captionHeight =
		CAPTION_MIN_HEIGHT + (estimateCaptionLines(caption) - 1) * CAPTION_LINE_HEIGHT;

	// 图片缩放到容器宽度; 超长图再等比缩小, 保证总高度不超过 Telegram 限制
	const maxImageHeight = MAX_OUTPUT_HEIGHT - captionHeight - OUTER_PADDING;
	let imageWidth = IMAGE_AREA_WIDTH;
	let imageHeight = Math.round((imgHeight / imgWidth) * IMAGE_AREA_WIDTH);
	if (imageHeight > maxImageHeight) {
		imageWidth = Math.round((imageWidth * maxImageHeight) / imageHeight);
		imageHeight = maxImageHeight;
	}
	const imageAreaHeight = Math.max(imageHeight, MIN_IMAGE_HEIGHT);

	// 总输出高度 = 图片区域 + 标题栏 + 外边距
	const outputHeight = imageAreaHeight + captionHeight + OUTER_PADDING;

	const response = new ImageResponse(
		<PolaroidTemplate
			imageSrc={dataUrl}
			imageWidth={imageWidth}
			imageHeight={imageHeight}
			caption={caption}
			captionHeight={captionHeight}
		/>,
		{
			width: OUTPUT_WIDTH,
			height: outputHeight,
			fonts,
			format: "jpeg",
			quality: 92,
		},
	);
	return Buffer.from(await response.arrayBuffer());
}

export default imgGen;
