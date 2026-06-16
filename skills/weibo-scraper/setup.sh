#!/bin/bash
# 微博抓取工具 - 环境配置
set -e

echo "========================================="
echo "  微博抓取工具 - 环境配置"
echo "========================================="

PYTHON=$(command -v python3)
echo "Python: $($PYTHON --version)"

echo ""
echo "📦 安装依赖..."
$PYTHON -m pip install requests --break-system-packages -q 2>/dev/null || \
$PYTHON -m pip install requests -q

echo ""
echo "🔍 验证..."
$PYTHON -c "import requests; print(f'  ✓ requests {requests.__version__}')"

echo ""
echo "========================================="
echo "  ✅ 配置完成!"
echo "========================================="
echo ""
echo "使用: python3 scripts/weibo_scraper.py --uid <UID或昵称> --count 5"
echo ""
echo "可选: export WEIBO_SUB=\"你的SUB值\"  (PC版API需要)"
