---
name: weibo-scraper
description: 微博用户内容抓取工具。支持按UID抓取微博，自动下载高清图片/视频，输出结构化信息。当用户要求抓取微博、查看某人微博、备份微博内容、分析微博数据时使用此技能。
---

# 微博抓取工具

抓取微博用户的内容，包括文字、高清图片和视频，输出结构化信息。

## 抓取策略

**PC版API（需要Cookie）：**
- 使用 `weibo.com` AJAX API
- 需要配置 `WEIBO_SUB` 环境变量
- 数据最全（含位置、设备等元数据）

## 快速使用

```bash
# 1. 环境配置
cd $(dirname "$0")  # 进入技能包目录
bash setup.sh

# 2. 配置Cookie
export WEIBO_SUB="你的SUB值"

# 3. 抓取（默认结构化输出）
python3 scripts/weibo_scraper.py --uid <UID> --count 5
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--uid` | UID | 必填 |
| `--count` | 抓取条数 | 10 |
| `--start` | 开始日期 YYYY-MM-DD | - |
| `--end` | 结束日期 YYYY-MM-DD | - |
| `--output` | 输出目录 | `./weibo_output` |
| `--no-media` | 不下载图片/视频 | false |
| `--json` | 输出JSON格式 | false |
| `--quiet` | 静默模式(仅JSON) | false |

## 输出格式

### 账号信息

```
📌 账号信息
- 昵称：用户名
- UID：数字ID
- 认证：认证信息
- 粉丝：XX万 | 微博数：XX条
```

### 单条微博

每条微博之间用 `---` 分隔：

```
---

🥇 第1条（置顶）
📅 2026-05-16 18:28 · 📍 韩国 · 📱 OPPO Reno15 Pro
正文内容...
🖼️ 图片 ×9
💬 转发 0.7万 | 评论 1.7万 | ❤️ 11.6万
🔗 [https://weibo.com/uid/mblogid](https://weibo.com/uid/mblogid)
```

### 资源标记规则

| 类型 | 格式 | 示例 |
|------|------|------|
| 纯文字 | （无标记） | 无图片无视频时不显示资源行 |
| 图片 | `🖼️ 图片 ×N` | `🖼️ 图片 ×9` |
| 视频 | `🎬 视频` | 1个视频 |
| 混合 | `🖼️ 图片 ×N + 🎬 视频` | 图片+视频 |

### 小结

```
---

小结：
前5条微博中包含：2条图文、1条视频
总互动：❤️ 41.6万 | 💬 12.4万
```

## 格式规范

- 时间格式：`YYYY-MM-DD HH:MM`（显示到分钟）
- 粉丝数：万级取整（如 `3169万`）
- 互动数：万级保留一位小数（如 `142.5万`）
- 链接格式：`🔗 [url](url)`（Markdown链接）
- 分隔线：每条微博之间用 `---` 分隔

## Cookie配置

```bash
export WEIBO_SUB="你的SUB值"
```

获取方法：
1. 浏览器登录微博
2. F12 → Application → Cookies → `.weibo.com`
3. 复制 `SUB` 值

## 输出文件

```
weibo_output/
└── 用户名_UID/
    ├── data.json          # 完整结构化数据
    ├── README.md          # 格式化汇总
    └── 2026-05-16_001_正文/
        ├── meta.json      # 单条元信息
        ├── text.txt       # 纯文本
        ├── image_01.jpg   # 图片
        └── video.mp4      # 视频
```

## 依赖

- Python 3
- `requests`
