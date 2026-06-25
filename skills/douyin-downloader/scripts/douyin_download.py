#!/usr/bin/env python3
"""
抖音无水印视频下载脚本
用法: python douyin_download.py <分享链接> [--quality <清晰度>] [--output <输出目录>] [--list-only]

混合方案：iesdouyin.com 获取视频元数据 + yt-dlp 下载。
兼顾无水印、多清晰度、自动格式合并。
"""

import argparse
import http.cookiejar
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request


# ── 常量 ──────────────────────────────────────────────────────────────────

UA_MOBILE = ('Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 '
             '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36')

QUALITY_MAP = {
    'high':    ['1080p', '1080', '1280p'],
    'medium':  ['720p', '720'],
    'low':     ['540p', '540', '480p', '480'],
    'lowest':  ['360p', '360', '240p'],
}
DEFAULT_QUALITY = 'high'


# ── HTTP 工具 ─────────────────────────────────────────────────────────────

def http_get(url: str, headers: dict = None, timeout: int = 15) -> tuple:
    hdrs = {'User-Agent': UA_MOBILE, 'Accept': 'text/html,*/*'}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        body = resp.read().decode('utf-8', errors='replace')
        return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace') if e.fp else ''
        return e.code, dict(e.headers) if e.headers else {}, body


def http_redirect_url(url: str, timeout: int = 15) -> str:
    hdrs = {'User-Agent': UA_MOBILE, 'Accept': 'text/html,*/*'}
    req = urllib.request.Request(url, headers=hdrs)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.url
    except urllib.error.HTTPError as e:
        return getattr(e, 'url', url)


def download_file(url: str, filepath: str, chunk_size: int = 8192):
    hdrs = {'User-Agent': UA_MOBILE, 'Referer': 'https://www.douyin.com/'}
    req = urllib.request.Request(url, headers=hdrs)
    resp = urllib.request.urlopen(req, timeout=120)
    total = int(resp.headers.get('Content-Length', 0))
    downloaded = 0
    with open(filepath, 'wb') as f:
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded / total * 100
                print(f"\r[↓] {pct:.1f}% ({downloaded:,}/{total:,})", end='', flush=True)
    print()


# ── yt-dlp 定位 ──────────────────────────────────────────────────────────

def find_yt_dlp() -> str | None:
    path = shutil.which('yt-dlp')
    if path:
        return path
    for candidate in [
        os.path.expanduser('~/.local/bin/yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
    ]:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


# ── 链接解析 ──────────────────────────────────────────────────────────────

def extract_url_from_text(text: str) -> str | None:
    text = text.strip()
    for pattern in [
        r'https?://v\.douyin\.com/\S+/?',
        r'https?://www\.douyin\.com/video/(\d+)',
        r'https?://www\.douyin\.com/discover\?modal_id=(\d+)',
        r'https?://m\.douyin\.com/share/video/(\d+)',
        r'https?://www\.douyin\.com/note/\d+',
    ]:
        m = re.search(pattern, text)
        if m:
            return m.group(0)
    if text.startswith('http'):
        return text
    return None


def resolve_share_url(share_url: str) -> str:
    try:
        final = http_redirect_url(share_url)
        print(f"[+] 短链: {share_url}")
        print(f"    -> {final}")
        return final
    except Exception as e:
        print(f"[-] 短链解析失败: {e}", file=sys.stderr)
        raise


def extract_aweme_id(url: str) -> str | None:
    for pattern in [
        r'/video/(\d+)',
        r'modal_id=(\d+)',
        r'aweme_id=(\d+)',
        r'item_ids=(\d+)',
        r'/note/(\d+)',
    ]:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    for key in ['aweme_id', 'item_ids', 'modal_id']:
        if key in qs:
            return qs[key][0]
    return None


# ── 通过 iesdouyin 获取视频信息 ──────────────────────────────────────────

def get_video_info_from_share(aweme_id: str) -> dict:
    share_url = f'https://www.iesdouyin.com/share/video/{aweme_id}/'
    status, _, html = http_get(share_url)
    if status != 200 or len(html) < 1000:
        raise RuntimeError(f"分享页请求失败 (status={status}, len={len(html)})")
    router_data = _extract_router_data(html)
    if not router_data:
        raise RuntimeError("无法从分享页提取 _ROUTER_DATA")
    item = _find_video_item(router_data)
    if not item:
        raise RuntimeError("未找到视频数据 (item_list)")
    return _parse_video_item(item)


def _extract_router_data(html: str) -> dict | None:
    idx = html.find('window._ROUTER_DATA')
    if idx < 0:
        return None
    eq_idx = html.find('=', idx)
    json_start = html.find('{', eq_idx)
    if json_start < 0:
        return None
    depth = 0
    i = json_start
    while i < len(html):
        if html[i] == '{':
            depth += 1
        elif html[i] == '}':
            depth -= 1
        if depth == 0:
            try:
                return json.loads(html[json_start:i + 1])
            except json.JSONDecodeError:
                return None
        i += 1
    return None


def _find_video_item(data) -> dict | None:
    if isinstance(data, dict):
        if 'videoInfoRes' in data:
            items = data['videoInfoRes'].get('item_list', [])
            if items:
                return items[0]
        if 'item_list' in data and isinstance(data['item_list'], list) and data['item_list']:
            return data['item_list'][0]
        for v in data.values():
            r = _find_video_item(v)
            if r:
                return r
    elif isinstance(data, list):
        for item in data:
            r = _find_video_item(item)
            if r:
                return r
    return None


def _parse_video_item(item: dict) -> dict:
    video = item.get('video', {})
    author = item.get('author', {})

    cover = video.get('cover', {}) or video.get('origin_cover', {})
    cover_urls = cover.get('url_list', []) if isinstance(cover, dict) else []
    cover_url = ''
    for u in cover_urls:
        if '.jpeg' in u or '.jpg' in u:
            cover_url = u
            break
    if not cover_url and cover_urls:
        cover_url = cover_urls[0]

    result = {
        'aweme_id': item.get('aweme_id', ''),
        'desc': item.get('desc', ''),
        'author': author.get('nickname', ''),
        'duration': video.get('duration', 0) // 1000,
        'width': video.get('width', 0),
        'height': video.get('height', 0),
        'cover_url': cover_url,
        'qualities': [],
    }

    play_addr = video.get('play_addr', {})
    play_urls = play_addr.get('url_list', [])
    if play_urls:
        raw_url = play_urls[0]
        no_wm_url = raw_url.replace('playwm', 'play')
        result['qualities'].append({
            'label': 'default',
            'url': no_wm_url,
            'width': video.get('width', 0),
            'height': video.get('height', 0),
            'bitrate': 0,
        })

    bit_rates = video.get('bit_rate') or []
    for br in bit_rates:
        br_urls = br.get('play_addr', {}).get('url_list', [])
        if br_urls:
            raw = br_urls[0]
            no_wm = raw.replace('playwm', 'play')
            result['qualities'].append({
                'label': br.get('gear_name', 'unknown'),
                'url': no_wm,
                'width': br.get('width', 0),
                'height': br.get('height', 0),
                'bitrate': br.get('bit_rate', 0),
            })

    if len(result['qualities']) > 1 and result['qualities'][0]['label'] == 'default':
        seen = set()
        unique = []
        for q in result['qualities']:
            key = (q['width'], q['height'])
            if key not in seen:
                seen.add(key)
                unique.append(q)
        result['qualities'] = unique

    if not result['qualities']:
        raise RuntimeError("未找到可下载的视频链接")
    return result


# ── 清晰度选择 ────────────────────────────────────────────────────────────

def select_quality(qualities: list[dict], preferred: str = DEFAULT_QUALITY) -> dict:
    if not qualities:
        raise RuntimeError("没有可用的清晰度")
    preferred_labels = QUALITY_MAP.get(preferred, QUALITY_MAP[DEFAULT_QUALITY])
    for label_pattern in preferred_labels:
        for q in qualities:
            if label_pattern.lower() in q['label'].lower():
                return q
    return sorted(qualities, key=lambda x: (x['height'], x['bitrate']), reverse=True)[0]


# ── 主函数 ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='抖音无水印视频下载工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''\
示例:
  %(prog)s "https://v.douyin.com/xxxxx/"
  %(prog)s "https://www.douyin.com/video/123456789" -q medium
  %(prog)s "https://v.douyin.com/xxxxx/" --list-only
  %(prog)s "分享文案 https://v.douyin.com/xxxxx/" -o ./downloads
  %(prog)s "https://v.douyin.com/xxxxx/" --json
        '''
    )
    parser.add_argument('url', help='抖音分享链接、视频ID或包含链接的文本')
    parser.add_argument('--quality', '-q', default='high',
                        choices=['high', 'medium', 'low', 'lowest'],
                        help='视频清晰度 (默认: high)')
    parser.add_argument('--output', '-o', default='.',
                        help='输出目录 (默认: 当前目录)')
    parser.add_argument('--list-only', '-l', action='store_true',
                        help='仅列出可用清晰度，不下载')
    parser.add_argument('--cover', '-c', action='store_true',
                        help='同时下载视频封面图')
    parser.add_argument('--json', '-j', action='store_true',
                        help='输出 JSON 格式')
    args = parser.parse_args()

    yt_dlp_bin = find_yt_dlp()

    # 1. 提取链接
    raw_url = extract_url_from_text(args.url)
    aweme_id = None

    if not raw_url:
        if args.url.strip().isdigit():
            aweme_id = args.url.strip()
            print(f"[+] 视频 ID: {aweme_id}")
        else:
            print(f"[-] 无法识别的输入: {args.url}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"[+] 输入链接: {raw_url}")

    # 2. 解析短链
    full_url = raw_url
    if raw_url and 'v.douyin.com' in raw_url:
        full_url = resolve_share_url(raw_url)

    # 3. 提取 aweme_id
    if not aweme_id:
        aweme_id = extract_aweme_id(full_url or args.url)
    if not aweme_id:
        print("[-] 无法提取视频 ID", file=sys.stderr)
        sys.exit(1)
    print(f"[+] 视频 ID: {aweme_id}")

    # 4. 获取视频信息
    print("[*] 正在解析视频...")
    try:
        info = get_video_info_from_share(aweme_id)
    except RuntimeError as e:
        print(f"[-] {e}", file=sys.stderr)
        sys.exit(1)

    # 5. JSON 输出
    if args.json:
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return

    # 6. 打印视频信息
    print(f"\n{'='*60}")
    print(f"📌 标题: {info['desc']}")
    print(f"👤 作者: {info['author']}")
    if info['duration']:
        mins, secs = divmod(info['duration'], 60)
        print(f"⏱  时长: {mins}:{secs:02d}")
    if info['width'] and info['height']:
        print(f"📐 分辨率: {info['width']}x{info['height']}")
    if info.get('cover_url'):
        print(f"🖼  封面: {info['cover_url'][:80]}...")
    print(f"🎬 可用清晰度: {len(info['qualities'])} 种")
    print(f"{'='*60}")

    print(f"\n{'─'*60}")
    print(f"{'#':<4} {'清晰度':<20} {'分辨率':<15}")
    print(f"{'─'*60}")
    for i, q in enumerate(info['qualities'], 1):
        res = f"{q['width']}x{q['height']}" if q['height'] else '未知'
        print(f"{i:<4} {q['label']:<20} {res:<15}")
    print(f"{'─'*60}")

    if args.list_only:
        return

    # 7. 选择清晰度
    selected = select_quality(info['qualities'], args.quality)
    print(f"\n[*] 选择: {selected['label']} ({selected['width']}x{selected['height']})")

    # 8. 下载
    os.makedirs(args.output, exist_ok=True)
    safe_desc = re.sub(r'[\\/:*?"<>|\n\r]', '_', info['desc'])[:80].strip('_ ')
    filename = f"{safe_desc}.mp4" if safe_desc else "video.mp4"
    filepath = os.path.join(args.output, filename)
    counter = 1
    base, ext = os.path.splitext(filepath)
    while os.path.exists(filepath):
        filepath = f"{base}_{counter}{ext}"
        counter += 1

    print(f"[↓] 下载视频: {filepath}")

    # 优先用 yt-dlp 下载
    if yt_dlp_bin:
        try:
            cmd = [
                yt_dlp_bin, '--no-warnings', '--no-check-certificates',
                '--referer', 'https://www.douyin.com/',
                '--user-agent', UA_MOBILE,
                '-o', filepath,
                '--no-part',
                selected['url'],
            ]
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in proc.stdout:
                line = line.rstrip()
                if line and ('[download]' in line or 'Merger' in line or 'Merging' in line):
                    print(f"  {line}", flush=True)
            proc.wait()
            if proc.returncode != 0:
                raise RuntimeError(f"yt-dlp 下载失败 (exit={proc.returncode})")
        except Exception as e:
            print(f"[!] yt-dlp 下载失败，回退到直接下载: {e}", file=sys.stderr)
            try:
                download_file(selected['url'], filepath)
            except Exception as e2:
                print(f"[-] 下载失败: {e2}", file=sys.stderr)
                sys.exit(1)
    else:
        try:
            download_file(selected['url'], filepath)
        except Exception as e:
            print(f"[-] 下载失败: {e}", file=sys.stderr)
            sys.exit(1)

    size = os.path.getsize(filepath)
    print(f"[✓] 视频完成: {filepath} ({size:,} bytes)")

    # 下载封面图
    if args.cover and info.get('cover_url'):
        cover_ext = '.jpg'
        if '.webp' in info['cover_url']:
            cover_ext = '.webp'
        cover_name = safe_desc + '_cover' + cover_ext if safe_desc else 'cover' + cover_ext
        cover_path = os.path.join(args.output, cover_name)
        c = 1
        while os.path.exists(cover_path):
            cover_path = os.path.join(args.output, f"{safe_desc}_cover_{c}{cover_ext}" if safe_desc else f"cover_{c}{cover_ext}")
            c += 1
        print(f"[↓] 下载封面: {cover_path}")
        try:
            download_file(info['cover_url'], cover_path)
            csize = os.path.getsize(cover_path)
            print(f"[✓] 封面完成: {cover_path} ({csize:,} bytes)")
        except Exception as e:
            print(f"[-] 封面下载失败: {e}", file=sys.stderr)


if __name__ == '__main__':
    main()
