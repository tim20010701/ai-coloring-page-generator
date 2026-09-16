#!/usr/bin/env bash
#
# 把 photlin.com 部署到 Cloudflare Pages（直传方式）。
#
# 本仓库里有两类文件，这个脚本只上传第一类：
#   1. 站点文件  —— 会上传，线上 https://photlin.com/ 能访问到的就是这些
#   2. 构建工具  —— 不上传（_src/、build_footer.py、deploy.sh、README.md、
#                   .gitattributes、.gitignore）
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
# 分两类收集：
#   1. 非页面文件 —— 写死清单，改动了要显式确认
#   2. 页面       —— 自动发现所有 index.html
# 页面用自动发现的原因：加新页面时最容易忘了往写死的清单里补一行，
# 而这种漏掉是静默的 —— 新页面根本不会上线，你还以为部署成功了。
# 构建工具（_src/、*.py、*.md）都不是 index.html，所以不会被误带上线。
SITE_FILES=(
  404.html
  _headers
  app.js
  robots.txt
  sitemap.xml
  styles.css
)

while IFS= read -r f; do
  SITE_FILES+=("$f")
done < <(find . -name index.html -not -path "./_src/*" -not -path "./.*" \
           | sed 's|^\./||' | LC_ALL=C sort)

# IndexNow 的密钥文件：仓库根目录下的 *.txt，文件名就是密钥本身。
# 注意不能简单地用 *.txt 全收 —— robots.txt 也是 .txt，会被重复收进来。
for f in *.txt; do
  [ -e "$f" ] || continue
  case " ${SITE_FILES[*]} " in
    *" $f "*) continue ;;   # 已在清单里（robots.txt），跳过
  esac
  SITE_FILES+=("$f")
done

# --- 组装一个只含站点文件的暂存目录 ---
# 两个坑，都在 Windows + Git Bash 下踩过：
#   1. 不用 mktemp：Git Bash 的 mktemp -d 可能返回 C:\tmp\... 这种并不存在的路径。
#   2. 不用 $(pwd) 拼绝对路径：那是 MSYS 形式 /c/Users/...，交给 Windows 版 Node
#      会被当成 C:\c\Users\... 而报 ENOENT。
# 所以这里用「当前目录下的相对路径」，Node 自己会按 cwd 解析正确。
STAGE=".deploy-stage.$$"
rm -rf "$STAGE"
mkdir -p "$STAGE"
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

# --- 交给 wrangler 的路径要转成 Windows 形式 ---
# 坑：Git Bash 下 process.cwd() 是对的，但 wrangler 是按 process.env.PWD 去解析目录的，
# 而 Git Bash 把 PWD 设成 /c/Users/... 这种 MSYS 形式，于是被解析成 C:\c\Users\... 报 ENOENT。
# 对策一：cygpath 转成 C:/Users/... 的绝对路径。
# 对策二：顺手把 PWD 去掉，让 wrangler 回退到正确的 process.cwd()。
STAGE_ARG="$STAGE"
if command -v cygpath >/dev/null 2>&1; then
  STAGE_ARG="$(cygpath -m "$(pwd)/$STAGE")"
fi

# --- 部署 ---
# 自检：输出里的 "Uploaded N files (M already uploaded)" 中，
# M 应该等于文件总数减 N。若 M 等于总数（N=0），说明仓库与线上完全一致。
( unset PWD; $WRANGLER pages deploy "$STAGE_ARG" \
    --project-name="$PROJECT_NAME" \
    --branch="$BRANCH" \
    --commit-dirty=true )

echo
echo "部署完成。请核对上面输出里的 'Uploaded N files (M already uploaded)'："
echo "  N=0                 -> 仓库与线上逐字节一致，符合预期"
echo "  N 等于文件总数      -> 有文件与线上不一致，检查是不是改了不该改的东西"
