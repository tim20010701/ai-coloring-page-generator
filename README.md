# photlin.com — AI Coloring Page Generator

Source of the site served at **https://photlin.com/**.

A free browser tool that turns a photo into black-and-white line art and exports it as a
printable A4 or US Letter page at 300 DPI. The conversion runs entirely in the browser:
the photo is never uploaded, and there is no server-side processing.

The reusable data, checklists and the standalone conversion module live in a separate
repository: [printable-coloring-page-toolkit](https://github.com/tim20010701/printable-coloring-page-toolkit).

---

## What is in this repository

This repository contains two kinds of files. Only the first kind is deployed.

### 1. Site files (deployed, served at https://photlin.com/)

| Path | Served at |
|---|---|
| `index.html` | `/` |
| `a4-vs-us-letter/index.html` | `/a4-vs-us-letter/` |
| `print-sizes/index.html` | `/print-sizes/` |
| `printable-coloring-page-checklist/index.html` | `/printable-coloring-page-checklist/` |
| `about/index.html` | `/about/` |
| `contact/index.html` | `/contact/` |
| `privacy/index.html` | `/privacy/` |
| `404.html` | 404 responses |
| `styles.css` | `/styles.css` |
| `app.js` | `/app.js` |
| `robots.txt` | `/robots.txt` |
| `sitemap.xml` | `/sitemap.xml` |
| `_headers` | not served; adds HTTP response headers |
| `<indexnow-key>.txt` | not linked; proves domain ownership for IndexNow |

The three guide pages carry the content that also lives as markdown and CSV in
[printable-coloring-page-toolkit](https://github.com/tim20010701/printable-coloring-page-toolkit),
so the site has citable material of its own rather than a single tool page.

### 2. Build tooling (not deployed)

| Path | Purpose |
|---|---|
| `_src/footer.html` | Footer partial, kept in sync across every page |
| `build_footer.py` | Injects `_src/footer.html` into every page; discovers pages automatically |
| `deploy.sh` | Deploys the site files (and only those) to Cloudflare Pages |
| `.gitattributes` | Pins every file to LF so a Windows checkout cannot drift from the live bytes |
| `.gitignore` | Keeps `deploy.sh`'s staging directory out of the repository |
| `README.md` | This file |

These are deliberately excluded from deployment. Requesting them on the live site returns
404.

---

## Deploying

The site is a Cloudflare Pages project using **direct upload** — it is not connected to
this repository, so pushing to `main` does **not** trigger a deployment. Use the script:

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
bash deploy.sh
```

(`bash deploy.sh` rather than `./deploy.sh`, so the file does not need the executable bit.)

`deploy.sh` stages only the site files into a temporary directory, normalises line endings
to LF, and uploads that. This is what keeps the repository and the live site identical.

The staging list is built in two parts: the non-page assets (`404.html`, `_headers`,
`app.js`, `robots.txt`, `sitemap.xml`, `styles.css`, and any root `*.txt`) are written out
explicitly, while pages are discovered automatically by finding every `index.html`. Pages
are auto-discovered on purpose: a hardcoded list silently drops a new page, so the page
never goes live and the deploy still reports success. Build tooling is never `index.html`,
so nothing extra can be swept up.

If `wrangler` is not on your `PATH`, point the script at it:

```sh
WRANGLER="node /path/to/wrangler/bin/wrangler.js" bash deploy.sh
```

### Checking that a deploy changed nothing

Cloudflare's uploader compares content hashes, so the deploy output tells you directly:

```
Uploaded 0 files (14 already uploaded)
```

Zero new uploads means every file you deployed is byte-identical to what was already live.
If instead all files are uploaded, something differs — check whether you intended to change
that many files.

### Verified state

All 14 site files in this repository are byte-identical (SHA-256) to the deployed files and
to the live HTTP responses, with the two documented exceptions below: `contact/index.html`
and `privacy/index.html` differ from the live response only by Cloudflare's email
obfuscation, and `_headers` is never served as an asset. Restoring the injected markup on
those two pages reproduces the repository bytes exactly.

Independently confirmed end-to-end: staging the site files and running `deploy.sh` against
the production project reported

```
Success! Uploaded 0 files (10 already uploaded)
```

Zero uploads means Cloudflare's own content hashes agreed that every staged file already
matched the live site.

### Rolling back

```sh
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/ai-coloring-page/deployments/<deployment-id>/rollback" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

List deployments to find the id to roll back to:

```sh
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/ai-coloring-page/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

---

## Notes that are easy to get wrong

**Line endings.** Git on Windows may check these files out with CRLF. The deployed files
use LF, so a CRLF working copy makes every file on the live site grow by a few dozen bytes.
This repository ships a `.gitattributes` containing `* text=auto eol=lf`, which forces LF on
checkout regardless of `core.autocrlf`. Verified: with `core.autocrlf=true` and no
`.gitattributes`, `index.html` checks out as 5325 bytes with 118 CRLF pairs; with
`.gitattributes` present it checks out as 5207 bytes, byte-identical to the live file.
`deploy.sh` also strips `\r` before uploading, as a second line of defence.

**The IndexNow key file has no trailing newline.** It is exactly the key, 32 bytes. Adding
a newline changes the deployed file; it still works, but then the repository and the live
site differ.

**`contact/index.html` and `privacy/index.html` do not match the live bytes.** Cloudflare's
edge injects email-obfuscation markup into pages containing an email address, adding about
239 bytes to each of those two responses. The files in this repository are the
pre-injection source; the difference is expected and is not drift.

The injected payload is randomised per response, so those two pages never hash to a stable
value: three consecutive fetches of `/contact/` all returned 2726 bytes with three
different SHA-256 digests. Do not treat a hash mismatch there as drift. To compare, first
strip the injected `<script ... email-decode.min.js>` tag and replace the
`/cdn-cgi/l/email-protection#...` anchor with the original `mailto:` link — the result is
byte-identical to this repository.

**`_headers` is not a static asset.** Cloudflare Pages parses it and applies the headers,
and returns 404 for `/_headers` itself.

**Running `deploy.sh` from Git Bash on Windows.** Two path traps, both handled by the
script but worth knowing:

- `mktemp -d` can return `C:\tmp\tmp.XXXX` even when `C:\tmp` does not exist, and wrangler
  then fails with `ENOENT ... scandir`. The script stages into a relative
  `.deploy-stage.<pid>` directory in the current folder instead.
- wrangler resolves its target directory against `process.env.PWD`, **not**
  `process.cwd()`. Git Bash sets `PWD=/c/Users/...`, which Node reads as `C:\c\Users\...`
  and fails with `ENOENT ... scandir`. The script converts the path with `cygpath -m` and
  also unsets `PWD` for the wrangler call. Passing a plain relative path is *not* enough.

**A plain `*.txt` glob is wrong for the IndexNow key.** `robots.txt` is also a `.txt` file,
so `for f in *.txt` adds it a second time and the allowlist silently stops being an
allowlist. The script skips anything already listed.

**Auto-discovery must skip dot-directories.** Both `build_footer.py` and `deploy.sh` find
pages by walking for `index.html`. `deploy.sh` leaves a `.deploy-stage.<pid>` directory
behind if it is interrupted, and an auto-discovery that does not skip dot-directories will
treat those staged copies as real pages — `build_footer.py` did exactly that once. Both
now exclude any path component starting with a dot.

**Non-browser User-Agents get a 403.** Cloudflare's bot protection in front of this site
rejects requests that do not look like a browser: `curl -A "Python-urllib/3.13"` returns
403 on every URL, including the IndexNow key file and the home page, while a browser UA
returns 200. Verified that search-engine crawler UAs are allowed through. If you script a
check against this site and see 403, set a browser User-Agent before concluding anything
is broken.

---

## License

No license is currently declared for the site content in this repository.
