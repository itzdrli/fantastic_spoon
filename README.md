# Fantastic Spoon Meme Bot

Telegram meme 审核和投稿机器人

## 功能特性

- 📝 Meme 投稿和审核流程
- 🔒 匿名投稿支持
- 💾 使用 Valkey (Redis) 持久化存储
- 🔄 多个提交同时处理
- 📤 自动同步到后端 API ([koishi-meme](https://kmeme.itzdrli.cc))

## 环境要求

- Bun
- Docker & Docker Compose
- Telegram Bot Token

## 环境变量

创建 `.env` 文件：

```env
# 必填, 缺少时启动失败
BOT_TOKEN=your_bot_token
REVIEW_GROUP_ID=your_review_group_id
ADMIN_IDS=admin_id1,admin_id2

# 选填, 不填则批准时不同步到 kmeme
KMEME_USERNAME=your_api_email
KMEME_PASSWORD=your_api_password
```

## 字体

字体文件不在仓库里, 运行前放到 `fonts/` 目录:

| 文件 | 来源 |
| --- | --- |
| `OPPOSansRegular.ttf` | OPPO Sans (OPPO 官方免费字体) |
| `IBMPlexSans-Regular.ttf` | [IBM Plex](https://github.com/IBM/plex) |
| `NotoColorEmoji-Regular.ttf` | [Noto Emoji](https://github.com/googlefonts/noto-emoji) |

## 运行

```bash
# 开发模式
bun run dev

# 开发 (Docker, 自动合并 docker-compose.override.yml: 热重载 + 源码挂载)
docker compose up

# 生产 (非 root, 不挂载源码)
docker compose -f docker-compose.yml up -d --build
```

## 更新日志

### 3.1

- 🔒 审核/匿名按钮改为原子操作, 多个管理员同时点击不会重复发布
- 🛟 发布失败时保留投稿, 管理员可以重试; 通知投稿人失败不再影响发布
- 🖼️ 超长图等比缩小, 不再超出 Telegram 的尺寸限制; 长标题自动换行; 输出 JPEG
- ⏳ 未完成的投稿 1 天后过期, 待审核投稿 30 天后过期
- 🧩 每次投稿有独立 ID, 同时进行多个投稿不会串
- 📷 相册 / 文件形式的图片会提示正确的发送方式
- 📮 审核消息上显示 kmeme 同步结果
- ⏱️ `/meme` 每人 10 秒冷却

### 3.0

- ✨ 标题自动处理：用户输入的标题会自动去掉开头的 `#`，发布到 Telegram 时自动添加 `#`
- 📝 API 提交标题不带 `#` 符号
- 💾 使用 Valkey (Redis) 持久化存储，解决多个 meme 同时提交时旧提交失效的问题
- 🔧 审核按钮使用 reviewMessageId 而非 userId，避免冲突
