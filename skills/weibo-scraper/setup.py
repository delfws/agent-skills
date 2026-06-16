#!/usr/bin/env python3
"""微博抓取工具 - 环境配置"""
import subprocess
import sys


def main():
    print("=" * 40)
    print("  微博抓取工具 - 环境配置")
    print("=" * 40)
    print(f"Python: {sys.version}\n")

    print("📦 安装依赖...")
    cmd = f"{sys.executable} -m pip install requests --break-system-packages -q"
    r = subprocess.run(cmd, shell=True, capture_output=True)
    if r.returncode != 0:
        subprocess.run(f"{sys.executable} -m pip install requests -q", shell=True)

    print("🔍 验证...")
    import requests
    print(f"  ✓ requests {requests.__version__}")

    print("\n" + "=" * 40)
    print("  ✅ 配置完成!")
    print("=" * 40)
    print("\n使用: python3 scripts/weibo_scraper.py --uid <UID或昵称> --count 5")


if __name__ == "__main__":
    main()
