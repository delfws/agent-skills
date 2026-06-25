---
name: douyin-downloader
description: 解析抖音分享链接，下载无水印视频和封面图。支持 v.douyin.com 短链、douyin.com 完整链接、纯数字 aweme_id、含链接的分享文案。当用户提供抖音视频链接并要求下载视频、获取封面、解析视频信息时使用此技能。
---

# 抖音无水印视频下载

混合方案：iesdouyin.com 获取视频元数据 + yt-dlp 下载。

## 依赖

- Python 3.10+（标准库）
- yt-dlp（可选，用于下载；没有则回退到直接 HTTP 下载）

```bash
pip install --break-system-packages yt-dlp
yt-dlp -U  # 升级
```

## 快速使用

```bash
# 下载视频（最高画质）
python3 <skill_dir>/scripts/douyin_download.py "<抖音链接>"

# 指定清晰度
python3 <skill_dir>/scripts/douyin_download.py "<链接>" -q medium

# 同时下载封面图
python3 <skill_dir>/scripts/douyin_download.py "<链接>" --cover

# 仅查看可用清晰度（不下载）
python3 <skill_dir>/scripts/douyin_download.py "<链接>" --list-only

# 输出到指定目录
python3 <skill_dir>/scripts/douyin_download.py "<链接>" -o ./downloads

# JSON 输出（方便程序调用）
python3 <skill_dir>/scripts/douyin_download.py "<链接>" --json
```

## 支持的输入格式

| 格式 | 示例 |
|------|------|
| 分享短链 | `https://v.douyin.com/xxxxx/` |
| 完整链接 | `https://www.douyin.com/video/123456789` |
| 纯数字 ID | `7647485561388780819` |
| 含链接文案 | `今晚油价下调 https://v.douyin.com/xxxxx/ 复制此链接...` |
| 图文笔记 | `https://www.douyin.com/note/123456789` |

## 参数

| 参数 | 说明 |
|------|------|
| `--quality, -q` | 清晰度：high / medium / low / lowest（默认 high） |
| `--output, -o` | 输出目录（默认当前目录） |
| `--cover, -c` | 同时下载视频封面图 |
| `--list-only, -l` | 仅列出可用清晰度，不下载 |
| `--json, -j` | 输出 JSON 格式 |

## 技术原理

1. 解析 `v.douyin.com` 短链 → 重定向获取 aweme_id
2. 访问 `iesdouyin.com` 分享页 → 提取 `window._ROUTER_DATA` 中的视频元数据
3. 从 `play_addr.url_list` 获取播放链接，`playwm` → `play` 去水印
4. 下载时优先用 yt-dlp（更好的进度显示和错误处理），没有则回退到直接 HTTP 下载

## 注意事项

- 需要网络访问
- yt-dlp 可选：有则用 yt-dlp 下载，没有则用 Python 标准库直接下载
- 部分视频只有单一清晰度（取决于上传者设置）
- 封面图格式可能是 webp 或 jpeg，脚本自动适配
