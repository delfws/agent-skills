---
name: douyin-downloader
description: 解析抖音分享链接，下载无水印视频和封面图。支持 v.douyin.com 短链、douyin.com 完整链接、纯数字 aweme_id、含链接的分享文案。当用户提供抖音视频链接并要求下载视频、获取封面、解析视频信息时使用此技能。
---

# 抖音无水印视频下载

纯 Python 标准库实现，无需 pip install。

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
4. 部分视频有 `bit_rate` 多清晰度数据，脚本自动适配

## 注意事项

- 需要网络访问（访问 douyin/iesdouyin 域名）
- 封面图格式可能是 webp 或 jpeg，脚本自动选择
- 部分视频只有一种清晰度（取决于上传者设置）
