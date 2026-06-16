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
// 底部标题区域固定高度
const CAPTION_HEIGHT = 72;
// 最小图片高度
const MIN_IMAGE_HEIGHT = 200;

// 输出图片宽度
export const OUTPUT_WIDTH = IMAGE_AREA_WIDTH + OUTER_PADDING;

function PolaroidTemplate({
	imageSrc,
	caption,
}: {
	imageSrc: string;
	caption: string;
}) {
	return (
		<div tw="flex flex-col bg-[#2e3440] w-full h-full items-center justify-center p-8">
			<div
				tw="flex flex-col bg-[#5e81ac] shadow-2xl rounded-3xl"
				style={{ width: IMAGE_AREA_WIDTH }}
			>
				<div tw="flex bg-[#2e3440] items-center justify-center">
					<img src={imageSrc} alt="Submitted meme" tw="w-full rounded-t-3xl" />
				</div>
				<div
					tw="flex bg-[#4c566a] border-t border-[#434c5e] px-5 items-center justify-center rounded-b-3xl"
					style={{ height: CAPTION_HEIGHT }}
				>
					<p tw="text-3xl font-semibold tracking-tight text-[#d8dee9] m-0">
						# {caption}
					</p>
				</div>
			</div>
		</div>
	);
}

/**
 * 从 Buffer 获取图片尺寸
 */
function getImageDimensionsFromBuffer(
	buffer: Buffer,
): { width: number; height: number } {
	// PNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50) {
		return {
			width: buffer.readUInt32BE(16),
			height: buffer.readUInt32BE(20),
		};
	}

	// JPEG
	if (buffer[0] === 0xff && buffer[1] === 0xd8) {
		let offset = 2;
		while (offset < buffer.length) {
			if (buffer[offset] !== 0xff) break;
			const marker = buffer[offset + 1];
			if (marker >= 0xc0 && marker <= 0xc2) {
				return {
					width: buffer.readUInt16BE(offset + 7),
					height: buffer.readUInt16BE(offset + 5),
				};
			}
			offset += 2 + buffer.readUInt16BE(offset + 2);
		}
	}

	// WebP
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45
	) {
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
			if (buffer[15] === 0x20) {
				return {
					width: (buffer[26] | (buffer[27] << 8)) & 0x3fff,
					height: (buffer[28] | (buffer[29] << 8)) & 0x3fff,
				};
			}
			if (buffer[15] === 0x4c) {
				const bits =
					buffer[21] |
					(buffer[22] << 8) |
					(buffer[23] << 16) |
					(buffer[24] << 24);
				return {
					width: (bits & 0x3fff) + 1,
					height: ((bits >> 14) & 0x3fff) + 1,
				};
			}
		}
	}

	return { width: IMAGE_AREA_WIDTH, height: IMAGE_AREA_WIDTH };
}

/**
 * 获取图片数据和尺寸
 */
async function getImageData(
	imageSrc: string,
): Promise<{ width: number; height: number; dataUrl: string }> {
	let buffer: Buffer;
	let dataUrl: string;

	if (imageSrc.startsWith("data:")) {
		dataUrl = imageSrc;
		buffer = Buffer.from(imageSrc.split(",")[1], "base64");
	} else {
		const response = await fetch(imageSrc);
		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		const contentType = response.headers.get("content-type") || "image/jpeg";
		dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
	}

	return { ...getImageDimensionsFromBuffer(buffer), dataUrl };
}

async function imgGen(imageSrc: string, caption: string) {
	const { width: imgWidth, height: imgHeight, dataUrl } =
		await getImageData(imageSrc);

	// 图片会被缩放到容器宽度，计算缩放后的高度
	const scaledHeight = Math.round((imgHeight / imgWidth) * IMAGE_AREA_WIDTH);
	const imageAreaHeight = Math.max(scaledHeight, MIN_IMAGE_HEIGHT);

	// 总输出高度 = 图片区域 + 标题栏 + 外边距
	const outputHeight = imageAreaHeight + CAPTION_HEIGHT + OUTER_PADDING;

	const response = new ImageResponse(
		<PolaroidTemplate imageSrc={dataUrl} caption={caption.trim()} />,
		{
			width: OUTPUT_WIDTH,
			height: outputHeight,
			fonts,
		},
	);
	return Buffer.from(await response.arrayBuffer());
}

export default imgGen;
