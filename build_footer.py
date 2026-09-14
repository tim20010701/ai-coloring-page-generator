#!/usr/bin/env python3
# 把页脚模板（_src/footer.html）注入 site/ 下所有页面的页脚区域。
# 页脚只在这一个文件里维护，改完跑一次，全站生效。
# 用法： python build_footer.py
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
PARTIAL = ROOT / "_src" / "footer.html"
SITE = ROOT / "site"

# 页面根目录：优先 site/（本工作区），没有就用脚本所在目录（GitHub 仓库里的平铺结构）
BASE = SITE if SITE.is_dir() else ROOT

PAGES = [
    BASE / "index.html",
    BASE / "about" / "index.html",
    BASE / "contact" / "index.html",
    BASE / "privacy" / "index.html",
    BASE / "404.html",
]

PATTERN = re.compile(r"[ \t]*<footer class=\"site-footer\">.*?</footer>", re.S)


def main():
    if not PARTIAL.exists():
        sys.exit("找不到页脚模板: %s" % PARTIAL)
    # newline='' 关掉换行转换，避免 Windows 上把 LF 改成 CRLF 导致整文件被改
    with open(PARTIAL, encoding="utf-8", newline="") as f:
        footer = f.read().rstrip("\n")

    changed = []
    for p in PAGES:
        if not p.exists():
            print("跳过（文件不存在）: %s" % p)
            continue
        with open(p, encoding="utf-8", newline="") as f:
            src = f.read()
        new, n = PATTERN.subn(lambda m: footer, src, count=1)
        if n == 0:
            print("!! 没找到页脚区块: %s" % p.relative_to(ROOT))
            continue
        if new != src:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(new)
            changed.append(p.relative_to(ROOT).as_posix())
            print("已更新: %s" % p.relative_to(ROOT).as_posix())
        else:
            print("无变化: %s" % p.relative_to(ROOT).as_posix())

    print("\n改了 %d 个文件" % len(changed))
    if changed:
        print("模板来源: %s" % PARTIAL.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
