#!/usr/bin/env python3
"""MiMo Omni — 多模态理解（图片/视频/音频）。

模型: mimo-v2.5
支持: 图片理解、视频理解、音频理解

Requires:
    pip install openai
    export MIMO_API_KEY=...
"""

import argparse
import base64
import mimetypes
import os
import sys
from pathlib import Path

from openai import OpenAI


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MiMo V2.5 多模态理解")
    parser.add_argument(
        "type",
        choices=["image", "video", "audio"],
        help="媒体类型: image / video / audio",
    )
    parser.add_argument(
        "input",
        help="文件路径或 URL",
    )
    parser.add_argument(
        "--prompt",
        required=True,
        help="文本提示",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=2,
        help="视频抽帧率 (仅 video 类型，默认 2)",
    )
    parser.add_argument(
        "--resolution",
        default="default",
        help="视频分辨率 (仅 video 类型，默认 default)",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=4096,
        help="最大输出 token 数 (默认 4096)",
    )
    return parser.parse_args()


def build_client() -> OpenAI:
    api_key = os.environ.get("MIMO_API_KEY")
    if not api_key:
        print("MIMO_API_KEY is not set", file=sys.stderr)
        sys.exit(1)
    return OpenAI(api_key=api_key, base_url="https://api.xiaomimimo.com/v1")


def load_media(media_type: str, file_input: str) -> dict:
    """根据类型和输入方式构建 content block。"""
    is_url = file_input.startswith("http://") or file_input.startswith("https://")

    if media_type == "image":
        if is_url:
            return {"type": "image_url", "image_url": {"url": file_input}}
        path = _resolve_path(file_input)
        mime = _guess_mime(path, "image/png")
        b64 = _read_base64(path)
        return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}

    if media_type == "video":
        if is_url:
            return {
                "type": "video_url",
                "video_url": {"url": file_input},
                "fps": 2,
                "media_resolution": "default",
            }
        path = _resolve_path(file_input)
        mime = _guess_mime(path, "video/mp4")
        b64 = _read_base64(path)
        return {
            "type": "video_url",
            "video_url": {"url": f"data:{mime};base64,{b64}"},
            "fps": 2,
            "media_resolution": "default",
        }

    if media_type == "audio":
        if is_url:
            return {"type": "input_audio", "input_audio": {"data": file_input}}
        path = _resolve_path(file_input)
        mime = _guess_mime(path, "audio/wav")
        b64 = _read_base64(path)
        return {"type": "input_audio", "input_audio": {"data": f"data:{mime};base64,{b64}"}}

    print(f"Unknown media type: {media_type}", file=sys.stderr)
    sys.exit(1)


def _resolve_path(file_input: str) -> Path:
    path = Path(file_input).resolve()
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    return path


def _guess_mime(path: Path, default: str) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    return mime or default


def _read_base64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def main() -> None:
    args = parse_args()
    client = build_client()

    media_block = load_media(args.type, args.input)

    completion = client.chat.completions.create(
        model="mimo-v2.5",
        max_tokens=args.max_tokens,
        messages=[
            {
                "role": "user",
                "content": [
                    media_block,
                    {"type": "text", "text": args.prompt},
                ],
            }
        ],
    )

    message = completion.choices[0].message
    if message.content:
        print(message.content)
    else:
        print("No content in response", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
