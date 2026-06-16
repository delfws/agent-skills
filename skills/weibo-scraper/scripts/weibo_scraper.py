#!/usr/bin/env python3
"""
微博用户内容抓取工具
抓取策略：PC版API（需要Cookie） → 移动版API回退

用法:
  python3 weibo_scraper.py --uid <用户ID> [--count <条数>] [--start <开始日期>] [--end <结束日期>]

示例:
  python3 weibo_scraper.py --uid 6634214154 --count 5
  python3 weibo_scraper.py --uid 孙千 --count 10
"""

import os
import re
import sys
import json
import time
import random
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("❌ 需要 requests: pip install requests --break-system-packages")
    sys.exit(1)


# ============================================================
#  PC版API抓取（主要方案，需要Cookie）
# ============================================================

class WeiboScraper:
    """通过 weibo.com PC版API抓取"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://weibo.com/",
            "X-Requested-With": "XMLHttpRequest",
        })
        self._load_cookie()

    def _load_cookie(self):
        sub = os.environ.get("WEIBO_SUB")
        if sub:
            self.session.cookies.set("SUB", sub, domain=".weibo.com")
            try:
                self.session.get("https://weibo.com", timeout=10)
            except Exception:
                pass
            self.session.headers["X-XSRF-TOKEN"] = self.session.cookies.get("XSRF-TOKEN", "")
            print("✅ Cookie已加载")
            return True
        print("❌ 未设置 WEIBO_SUB 环境变量")
        return False

    def get_user_info(self, uid):
        """获取用户详细信息"""
        try:
            resp = self.session.get(f"https://weibo.com/ajax/profile/info?uid={uid}", timeout=15)
            data = resp.json()
            if data.get("ok") == 1:
                return data["data"]["user"]
        except Exception as e:
            print(f"  ⚠️ 获取用户信息失败: {e}")
        return None

    def fetch_weibos(self, uid, count=10, start_date=None, end_date=None):
        """抓取微博列表"""
        start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
        end_dt = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)) if end_date else None

        weibos = []
        page = 1

        while page <= 200:
            url = f"https://weibo.com/ajax/statuses/mymblog?uid={uid}&page={page}&feature=0"
            try:
                resp = self.session.get(url, timeout=15)
                data = resp.json()
            except Exception as e:
                print(f"  ⚠️ 第{page}页失败: {e}")
                break

            if data.get("ok") != 1:
                break

            statuses = data.get("data", {}).get("list", [])
            if not statuses:
                break

            stop = False
            for st in statuses:
                weibo = self._parse(st)
                if not weibo:
                    continue
                if weibo["datetime"]:
                    post_dt = datetime.strptime(weibo["datetime"], "%Y-%m-%d %H:%M:%S")
                    if end_dt and post_dt >= end_dt:
                        continue
                    if start_dt and post_dt < start_dt:
                        stop = True
                        break
                weibos.append(weibo)
                if count and len(weibos) >= count:
                    stop = True
                    break
            if stop:
                break
            page += 1
            time.sleep(1)

        return weibos

    def _parse(self, st):
        """解析单条微博 - 提取完整元数据"""
        # 解析时间
        created_at = st.get("created_at", "")
        try:
            dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
            datetime_str = dt.strftime("%Y-%m-%d %H:%M:%S")
            date_str = dt.strftime("%Y-%m-%d")
        except:
            datetime_str = created_at
            date_str = created_at[:10] if created_at else ""

        # 提取来源/设备
        source = st.get("source", "")
        source = re.sub(r'<[^>]+>', '', source)  # 清理HTML标签

        # 提取位置
        region_name = st.get("region_name", "")
        region_name = region_name.replace("发布于 ", "").replace("发布于", "")

        # 提取文本
        text = st.get("text_raw", "")

        # 提取图片
        images = []
        pic_ids = st.get("pic_ids", [])
        if pic_ids:
            for pid in pic_ids:
                if pid:
                    wx = random.choice(["wx1", "wx2", "wx3", "wx4"])
                    images.append(f"https://{wx}.sinaimg.cn/large/{pid}.jpg")

        # 提取视频
        video = None
        video_title = ""
        pi = st.get("page_info", {}) or {}
        mi = pi.get("media_info", {}) or pi.get("urls", {}) or {}
        # type=11 或 "11" 表示视频
        pi_type = str(pi.get("type", ""))
        is_video = (
            pi_type == "11" or
            pi_type == "video" or
            pi.get("page_type") == "video"
        )
        if is_video and mi:
            video = (
                mi.get("mp4_720p_mp4") or      # 超清
                mi.get("stream_url_hd") or      # 高清
                mi.get("mp4_hd_mp4") or         # 高清
                mi.get("mp4_hd_url") or         # 高清
                mi.get("stream_url") or         # 流畅
                mi.get("mp4_ld_mp4") or         # 流畅
                mi.get("mp4_sd_url")            # 标清
            )
            video_title = mi.get("video_title") or pi.get("page_title") or ""

        # 构建微博链接
        mblogid = st.get("mblogid", "")
        uid = st.get("user", {}).get("id", "") or st.get("uid", "")
        weibo_url = f"https://weibo.com/{uid}/{mblogid}" if mblogid else ""

        return {
            "id": st.get("id", ""),
            "mblogid": mblogid,
            "text": text,
            "datetime": datetime_str,
            "date": date_str,
            "source": source,
            "region": region_name,
            "reposts": st.get("reposts_count", 0),
            "comments": st.get("comments_count", 0),
            "likes": st.get("attitudes_count", 0),
            "images": images,
            "video": video,
            "video_title": video_title,
            "url": weibo_url,
            "is_top": st.get("isTop", 0),
        }


# ============================================================
#  格式化输出
# ============================================================

def format_user_info(user):
    """格式化用户信息"""
    if not user:
        return ""
    
    lines = [
        "📌 账号信息",
        f"- 昵称：{user.get('screen_name', '')}",
        f"- UID：{user.get('id', '')}",
    ]
    
    verified_reason = user.get("verified_reason", "")
    if verified_reason:
        lines.append(f"- 认证：{verified_reason}")
    
    followers = user.get("followers_count", 0)
    followers_str = f"{followers/10000:.0f}万" if followers >= 10000 else str(followers)
    statuses = user.get("statuses_count", 0)
    lines.append(f"- 粉丝：{followers_str} | 微博数：{statuses}条")
    
    return "\n".join(lines)


def format_weibo(index, weibo):
    """格式化单条微博 - 结构化输出"""
    medals = ["🥇", "🥈", "🥉"]
    prefix = medals[index - 1] if index <= 3 else f"{index}️⃣"
    top_mark = "（置顶）" if weibo.get("is_top") else ""
    
    lines = [f"{prefix} 第{index}条{top_mark}"]
    
    # 时间、位置、设备
    meta_parts = []
    if weibo.get("datetime"):
        dt = weibo['datetime']
        if len(dt) >= 16:
            dt = dt[:16]
        meta_parts.append(f"📅 {dt}")
    if weibo.get("region"):
        meta_parts.append(f"📍 {weibo['region']}")
    if weibo.get("source"):
        meta_parts.append(f"📱 {weibo['source']}")
    if meta_parts:
        lines.append(" · ".join(meta_parts))
    
    # 正文
    text = weibo.get("text", "")
    if text:
        text = re.sub(r'#([^#]+)#', r'#\1#', text)
        lines.append(text)
    
    # 资源
    images = weibo.get("images", [])
    has_video = bool(weibo.get("video"))
    
    if images and has_video:
        lines.append(f"🖼️ 图片 ×{len(images)} + 🎬 视频")
    elif images:
        lines.append(f"🖼️ 图片 ×{len(images)}")
    elif has_video:
        lines.append(f"🎬 视频")
    
    # 互动数据
    parts = []
    if weibo.get("reposts"):
        r = weibo["reposts"]
        parts.append(f"转发 {r/10000:.1f}万" if r >= 10000 else f"转发 {r}")
    if weibo.get("comments"):
        c = weibo["comments"]
        parts.append(f"评论 {c/10000:.1f}万" if c >= 10000 else f"评论 {c}")
    if weibo.get("likes"):
        l = weibo["likes"]
        parts.append(f"❤️ {l/10000:.1f}万" if l >= 10000 else f"❤️ {l}")
    if parts:
        lines.append(f"💬 {' | '.join(parts)}")
    
    # 链接
    if weibo.get("url"):
        url = weibo['url']
        lines.append(f"🔗 [{url}]({url})")
    
    return "\n".join(lines)


def format_all(user, weibos):
    """格式化完整输出"""
    output = []
    
    if user:
        output.append(format_user_info(user))
    
    for i, weibo in enumerate(weibos, 1):
        output.append("")
        output.append("---")
        output.append("")
        output.append(format_weibo(i, weibo))
    
    output.append("")
    output.append("---")
    output.append("")
    output.append("小结：")
    
    music_count = sum(1 for w in weibos if "MV" in w.get("text", "") or "专辑" in w.get("text", "") or "新歌" in w.get("text", "") or "上线" in w.get("text", ""))
    photo_count = sum(1 for w in weibos if w.get("images") and not w.get("video"))
    video_count = sum(1 for w in weibos if w.get("video") and not w.get("images"))
    
    summary_parts = []
    if music_count:
        summary_parts.append(f"{music_count}条音乐作品")
    if photo_count:
        summary_parts.append(f"{photo_count}条图文")
    if video_count:
        summary_parts.append(f"{video_count}条视频")
    
    if summary_parts:
        output.append(f"前{len(weibos)}条微博中包含：{'、'.join(summary_parts)}")
    
    total_likes = sum(w.get("likes", 0) for w in weibos)
    total_comments = sum(w.get("comments", 0) for w in weibos)
    if total_likes >= 10000 or total_comments >= 10000:
        output.append(f"总互动：❤️ {total_likes/10000:.1f}万 | 💬 {total_comments/10000:.1f}万")
    
    return "\n".join(output)


# ============================================================
#  保存
# ============================================================

def save_files(weibos, uid, user, output_dir, no_media=False):
    """保存文件"""
    if not weibos:
        return
    
    username = user.get("screen_name", str(uid)) if user else str(uid)
    user_dir = Path(output_dir) / f"{username}_{uid}"
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # 保存结构化JSON
    data = {
        "user": {
            "screen_name": user.get("screen_name", ""),
            "id": user.get("id", ""),
            "verified_reason": user.get("verified_reason", ""),
            "followers_count": user.get("followers_count", 0),
            "statuses_count": user.get("statuses_count", 0),
        },
        "weibos": weibos,
    }
    (user_dir / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    
    # 保存Markdown
    md_content = format_all(user, weibos)
    (user_dir / "README.md").write_text(md_content, encoding="utf-8")
    
    print(f"\n📁 保存到: {user_dir}")
    
    # 下载媒体
    if no_media:
        print("  (跳过媒体下载)")
        return
    
    dl_session = requests.Session()
    dl_session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://weibo.com/",
    })
    
    for i, weibo in enumerate(weibos, 1):
        date_str = weibo.get("date", "unknown")
        text_preview = re.sub(r'[\\/:*?"<>|\n\r\t]', '', weibo.get("text", "")[:30]).strip() or "no_text"
        folder = user_dir / f"{date_str}_{i:03d}_{text_preview}"
        folder.mkdir(parents=True, exist_ok=True)
        
        # 保存元信息
        (folder / "meta.json").write_text(json.dumps(weibo, ensure_ascii=False, indent=2), encoding="utf-8")
        (folder / "text.txt").write_text(weibo.get("text", ""), encoding="utf-8")
        
        # 下载图片
        for j, img_url in enumerate(weibo.get("images", []), 1):
            fp = folder / f"image_{j:02d}.jpg"
            if fp.exists():
                continue
            try:
                resp = dl_session.get(img_url, timeout=60, stream=True)
                resp.raise_for_status()
                with open(fp, "wb") as f:
                    for chunk in resp.iter_content(8192):
                        f.write(chunk)
                print(f"  📷 [{i}] image_{j:02d}.jpg")
            except Exception as e:
                print(f"  ⚠️ 图片下载失败: {e}")
        
        # 下载视频
        if weibo.get("video"):
            fp = folder / "video.mp4"
            if not fp.exists():
                try:
                    resp = dl_session.get(weibo["video"], timeout=120, stream=True)
                    resp.raise_for_status()
                    with open(fp, "wb") as f:
                        for chunk in resp.iter_content(8192):
                            f.write(chunk)
                    print(f"  🎬 [{i}] video.mp4")
                except Exception as e:
                    print(f"  ⚠️ 视频下载失败: {e}")


# ============================================================
#  CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="微博抓取工具")
    parser.add_argument("--uid", required=True, help="UID")
    parser.add_argument("--count", type=int, default=10, help="抓取条数")
    parser.add_argument("--start", default=None, help="开始日期 YYYY-MM-DD")
    parser.add_argument("--end", default=None, help="结束日期 YYYY-MM-DD")
    parser.add_argument("--output", default="./weibo_output", help="输出目录")
    parser.add_argument("--no-media", action="store_true", help="不下载图片/视频")
    parser.add_argument("--json", action="store_true", help="输出JSON格式")
    parser.add_argument("--quiet", action="store_true", help="静默模式(仅输出JSON)")
    args = parser.parse_args()

    uid = args.uid

    # 初始化
    scraper = WeiboScraper()
    if not scraper._load_cookie():
        print("提示: export WEIBO_SUB=\"你的SUB值\"")
        sys.exit(1)

    # 获取用户信息
    if not args.quiet:
        print(f"\n🔍 获取用户信息...")
    user = scraper.get_user_info(uid)
    if user and not args.quiet:
        print(f"✅ {user.get('screen_name', '')} | 粉丝:{user.get('followers_count',0)} | 微博:{user.get('statuses_count',0)}")

    # 抓取微博
    if not args.quiet:
        print(f"\n📥 抓取最近 {args.count} 条微博...")
    weibos = scraper.fetch_weibos(uid, args.count, args.start, args.end)
    if not weibos:
        if not args.quiet:
            print("❌ 未抓取到微博")
        sys.exit(1)

    if not args.quiet:
        print(f"✅ 成功抓取 {len(weibos)} 条微博")

    # 输出
    if args.json or args.quiet:
        output = {
            "user": user,
            "weibos": weibos,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        # 默认结构化输出
        print("\n" + "=" * 60)
        print(format_all(user, weibos))
        print("=" * 60)

    # 保存文件
    save_files(weibos, uid, user, args.output, args.no_media)


if __name__ == "__main__":
    main()
