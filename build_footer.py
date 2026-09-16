#!/usr/bin/env python3
# 把页脚模板（_src/footer.html）注入 BASE 下所有页面的页脚区域。
# 页脚只在这一个文件里维护，改完跑一次，全站生效。
# 页面清单是自动发现的（所有 index.html + 404.html），加新页面不用改这里。
# 用法： python build_footer.py
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
PARTIAL = ROOT / "_src" / "footer.html"
SITE = ROOT / "site"

# 页面根目录：优先 site/（本工作区），没有就用脚本所在目录（GitHub 仓库里的平铺结构）
BASE = SITE if SITE.is_dir() else ROOT

# 自动发现页面：BASE 下所有 index.html（含子目录）+ 404.html。
# 原来是写死的清单，加新页面时容易忘了往这里补一行，结果新页面页脚悄悄不同步。
# 改成自动发现，加了页面不用改这个脚本。
EXCLUDE_DIRS = {"_src", ".git", "node_modules"}


def discover_pages():
    pages = set()
    for p in BASE.rglob("index.html"):
        parts = p.relative_to(BASE).parts
        # 跳过 _src/ 之类的构建目录，以及任何点开头的目录
        # （deploy.sh 的暂存目录 .deploy-stage.* 就藏在这里面，不能当页面处理）
        if EXCLUDE_DIRS.intersection(parts) or any(x.startswith(".") for x in parts):
            continue
        pages.add(p)
    top_404 = BASE / "404.html"
    if top_404.exists():
        pages.add(top_404)
    return sorted(pages, key=lambda x: x.relative_to(BASE).as_posix())


PAGES = discover_pages()

PATTERN = re.compile(r"[ \t]*<footer class=\"site-footer\">.*?</footer>", re.S)


def main():
    if not PARTIAL.exists():
        sys.exit("找不到页脚模板: %s" % PARTIAL)
    print("发现 %d 个页面：" % len(PAGES))
    for p in PAGES:
        print("  %s" % p.relative_to(BASE).as_posix())
    print()
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
