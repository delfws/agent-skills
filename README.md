# Agent Skills

为 AI Agent 提供的实用技能包集合。支持通过 `npx skills` 安装。

## 技能包一览

| 技能包 | 说明 | 依赖 |
|--------|------|------|
| [article-writer](skills/article-writer) | 图文长文写作，联网搜索+配图嵌入，口语化风格 | 无 |
| [douyin-downloader](skills/douyin-downloader) | 抖音无水印视频下载，支持短链/完整链接/分享文案 | Python 3 |
| [weibo-scraper](skills/weibo-scraper) | 微博用户内容抓取，含高清图片/视频下载 | Python 3 |
| [teaching-plan-generator](skills/teaching-plan-generator) | 根据课文自动生成完整教案，支持文字和图片输出 | Node.js |

## 快速安装

```bash
# 安装所有技能包
npx skills add delfws/agent-skills

# 安装单个技能包
npx skills add delfws/agent-skills --skill article-writer

# 安装到特定 Agent
npx skills add delfws/agent-skills -a <agent-name>

# 全局安装（所有项目可用）
npx skills add delfws/agent-skills -g
```

## 各技能包详情

### 📝 article-writer（图文长文写作）

联网搜索保证内容真实，配图嵌入正文，输出 Markdown 文件，封面优先选图。

触发词：写文章、写稿子、帮我写、出稿

### 📥 douyin-downloader（抖音无水印视频下载）

纯 Python 标准库实现，无需 pip install。支持：
- `v.douyin.com` 短链接
- `douyin.com` 完整链接
- 纯数字 `aweme_id`
- 包含链接的分享文案

自动下载无水印视频和封面图。

### 🔍 weibo-scraper（微博内容抓取）

按 UID 抓取微博用户内容，自动下载高清图片和视频，输出结构化信息。

首次使用需运行 `setup.sh` 安装依赖。

### 📋 teaching-plan-generator（教案生成）

根据课文内容（文字或图片）自动生成完整教案，包含：
- 教学目标
- 教学分析
- 教学过程（教师活动 / 学生活动 / 设计意图）
- 板书设计
- 教学反思

支持输出为文字和图片两种格式。

## 本地开发

```bash
git clone https://github.com/delfws/agent-skills.git
cd agent-skills

# 本地安装到 Agent
npx skills add ./ -a <agent-name>
```

## License

MIT
