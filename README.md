# Fantastic Spoon Meme Bot

Telegram meme 审核和投稿机器人

## 功能特性

- 📝 Meme 投稿和审核流程
- 🔒 匿名投稿支持
- 💾 使用 Valkey (Redis) 持久化存储
- 🔄 多个提交同时处理
- 📤 自动同步到后端 API

## 环境要求

- Bun
- Docker & Docker Compose
- Telegram Bot Token

## 环境变量

创建 `.env` 文件：

```env
BOT_TOKEN=your_bot_token
REVIEW_GROUP_ID=your_review_group_id
ADMIN_IDS=admin_id1,admin_id2
KMEME_USERNAME=your_api_username
KMEME_PASSWORD=your_api_password
```

## 运行

```bash
# 开发模式
bun run dev

# Docker Compose
docker-compose up -d
```

## 更新日志

### 最新版本

- ✨ 标题自动处理：用户输入的标题会自动去掉开头的 `#`，发布到 Telegram 时自动添加 `#`
- 📝 API 提交标题不带 `#` 符号
- 🎨 频道发布格式优化：
  ```
  📝 # 标题
  👤 Via 用户ID
  投稿: @FantasticSpoonBot
  ```
- 💾 使用 Valkey (Redis) 持久化存储，解决多个 meme 同时提交时旧提交失效的问题
- 🔧 审核按钮使用 reviewMessageId 而非 userId，避免冲突
