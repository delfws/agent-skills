---
name: mimo-v2-5-omni
description: "MiMo V2.5 多模态理解。使用小米 MiMo V2.5 模型进行图片、视频、音频的理解与分析。当需要识别图片内容、分析截图、OCR 文字提取、视频内容分析、音频转录、或用户发送了图片/视频/音频文件时激活此 skill。"
license: MIT
metadata:
  version: 0.1.0
---

# MiMo Omni

使用小米 MiMo V2.5 模型进行多模态理解。支持图片、视频、音频三种媒体类型，支持本地文件和 URL 输入。

脚本目录：`$SKILLS_PATH/mimo-v2-5-omni/scripts/`

> **`$SKILLS_PATH` 说明：** skills 目录路径，因部署环境而异。

## 能力概览

| 类型 | 支持格式 | 说明 |
|------|---------|------|
| **图片理解** | jpg, png, gif, webp, bmp | 图片描述、OCR、分类、对比 |
| **视频理解** | mp4, webm, avi, mov | 视频内容分析、画面描述、关键信息提取 |
| **音频理解** | mp3, wav, flac, ogg, m4a | 语音转录、音频内容分析 |

## 环境依赖

| 环境变量 | 说明 | 必需 |
|---------|------|------|
| `MIMO_API_KEY` | MiMo API 密钥（MiMo 开放平台获取） | 是 |

| 依赖 | 说明 | 必需 |
|------|------|------|
| `python3` | 运行脚本 | 是 |
| `openai` | `pip install openai` | 是 |

## 用法

### 图片理解

```bash
python3 $SKILLS_PATH/mimo-v2-5-omni/scripts/mimo_omni.py image /path/to/photo.jpg --prompt "描述这张图片的内容"
```

### 视频理解

```bash
python3 $SKILLS_PATH/mimo-v2-5-omni/scripts/mimo_omni.py video /path/to/video.mp4 --prompt "总结这个视频的内容"
```

### 音频理解

```bash
python3 $SKILLS_PATH/mimo-v2-5-omni/scripts/mimo_omni.py audio /path/to/audio.mp3 --prompt "转录这段音频"
```

### URL 输入

```bash
python3 $SKILLS_PATH/mimo-v2-5-omni/scripts/mimo_omni.py image "https://example.com/photo.jpg" --prompt "这是什么？"
```

### 视频参数

```bash
python3 $SKILLS_PATH/mimo-v2-5-omni/scripts/mimo_omni.py video /path/to/video.mp4 \
  --prompt "描述视频内容" \
  --fps 5 \
  --resolution high
```

## 使用场景

| 场景 | 类型 | 提示词示例 |
|------|------|-----------|
| 图片描述 | image | "描述这张图片的内容" |
| OCR 文字提取 | image | "提取图片中的所有文字，保持原始格式" |
| 截图分析 | image | "分析这张截图，说明界面上有什么" |
| 视频内容总结 | video | "总结这个视频的主要内容" |
| 视频数据提取 | video | "提取视频中出现的所有数据和文字" |
| 语音转录 | audio | "完整转录这段音频中说的每一句话" |
| 音频分析 | audio | "分析这段音频的内容和情绪" |

## 注意事项

- 大文件（视频/音频）处理时间较长，超时设为 300 秒
- URL 输入需确保链接可公开访问
- 视频默认抽帧率 2fps，可通过 `--fps` 调整
- 音频建议先用 ffmpeg 转为 wav 格式以获得最佳效果
