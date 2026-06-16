# 使用官方 Bun 镜像
FROM oven/bun:1 AS base
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 复制依赖文件
# 如果你有 bun.lockb 请取消下面注释并添加到 COPY 指令中
# COPY package.json bun.lockb ./
COPY package.json ./

# 安装生产依赖
RUN bun install --production

# 复制源代码
COPY . .

# 启动应用
CMD ["bun", "src/index.ts"]
