#!/usr/bin/env bash
#
# 把 photlin.com 部署到 Cloudflare Pages（直传方式）。
#
# 本仓库里有两类文件，这个脚本只上传第一类：
#   1. 站点文件  —— 会上传，线上 https://photlin.com/ 能访问到的就是这些
#   2. 构建工具  —— 不上传（_src/、build_footer.py、deploy.sh、README.md、.gitattributes）
#
# 站点文件清单写死在下面的 SITE_FILES 里，所以"从仓库部署"的结果永远等于
# 仓库里的站点文件，不会有构建工具被误发到线上。
#
# 用法：
#   export CLOUDFLARE_API_TOKEN=...
#   export CLOUDFLARE_ACCOUNT_ID=...
#   bash deploy.sh
#
# 依赖 wrangler。如果 wrangler 不在 PATH 里，用 WRANGLER 环境变量指定入口，例如：
#   WRANGLER="node /path/to/wrangler/bin/wrangler.js" bash deploy.sh

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-ai-coloring-page}"
BRANCH="${BRANCH:-main}"
WRANGLER="${WRANGLER:-npx wrangler}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "错误：没有设置 CLOUDFLARE_API_TOKEN" >&2
  exit 1
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "错误：没有设置 CLOUDFLARE_ACCOUNT_ID" >&2
  exit 1
fi

# --- 站点文件：必须与线上逐字节一致 ---
SITE_FILES=(
  404.html
  _headers
  about/index.html
  app.js
  contact/index.html
  index.html
  privacy/index.html
  robots.txt
  sitemap.xml
  styles.css
)

# IndexNow 的密钥文件：仓库根目录下的 *.txt（文件名就是密钥本身）
for f in *.txt; do
  [ -e "$f" ] && SITE_FILES+=("$f")
done

# --- 组装一个只含站点文件的临时目录 ---
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

for f in "${SITE_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少站点文件 $f" >&2
    exit 1
  fi
  mkdir -p "$STAGE/$(dirname "$f")"
  # 统一成 LF。仓库里存的本来就是 LF，这一步是防止在 Windows 上编辑后
  # 混进 CRLF 导致线上文件变大。
  tr -d '\r' < "$f" > "$STAGE/$f"
done

echo "将要部署 ${#SITE_FILES[@]} 个站点文件："
for f in "${SITE_FILES[@]}"; do echo "  $f"; done
echo

# --- 部署 ---
# 自检：输出里的 "Uploaded N files (M already uploaded)" 中，
# M 应该等于文件总数减 N。若 M 等于总数（N=0），说明仓库与线上完全一致。
$WRANGLER pages deploy "$STAGE" \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-dirty=true

echo
echo "部署完成。请核对上面输出里的 'Uploaded N files (M already uploaded)'："
echo "  M 等于文件总数减 N  -> 其余文件与线上逐字节一致，符合预期"
echo "  N 等于文件总数      -> 有文件与线上不一致，检查是不是改了不该改的东西"
