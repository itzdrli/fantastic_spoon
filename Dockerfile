# syntax=docker/dockerfile:1
#Fantastic Spoon — Telegram meme 投稿/审核 bot
# 运行时为 Bun + TSX,使用 @takumi-rs/image-response 的原生模块。
# 锁文件中同时包含 gnu/musl 两种变体,可选 Alpine;此处沿用 debian 更稳妥。

# ── 依赖层:仅依据 lockfile 安装,与源码变化解耦,最大化缓存复用 ──
FROM oven/bun:1.4.3-debian AS deps
WORKDIR /app

# 只复制依赖清单,源码改动不会击穿这一层
COPY package.json bun.lock ./

# --frozen-lockfile:构建可复现;缓存挂载加速重复构建
RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production

# ── 运行层:同一基础镜像,只带走运行所需文件,镜像更小更安全 ──
FROM oven/bun:1.4.3-debian AS runtime
WORKDIR /app

ENV NODE_ENV=production \
	TZ=Asia/Shanghai

# 生产依赖(来自 deps 层)
COPY --from=deps /app/node_modules ./node_modules
# 源码 / 字体 / 配置
COPY package.json ./
COPY src ./src
COPY fonts ./fonts
COPY tsconfig.json ./

# 日志目录(供运行时写入,命名卷挂载时会继承这里的属主)
# oven/bun 镜像已预置 bun 用户;只有 logs 需要可写,源码保持 root 只读
RUN mkdir -p /app/logs \
	&& chown bun:bun /app/logs

# 非 root 运行(使用镜像内置的 bun 用户)
USER bun

# 启动:bun run start = bun run src/index.ts(见 package.json)
CMD ["bun", "run", "start"]
