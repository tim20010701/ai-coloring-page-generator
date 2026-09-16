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

### 2. Build tooling (not deployed)

| Path | Purpose |
|---|---|
| `_src/footer.html` | Footer partial, kept in sync across the four pages |
| `build_footer.py` | Injects `_src/footer.html` into every page |
| `deploy.sh` | Deploys the site files (and only those) to Cloudflare Pages |
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

`deploy.sh` copies only the files listed under *Site files* above into a staging directory,
normalises line endings to LF, and uploads that. This is what keeps the repository and the
live site identical.

If `wrangler` is not on your `PATH`, point the script at it:

```sh
WRANGLER="node /path/to/wrangler/bin/wrangler.js" ./deploy.sh
```

### Checking that a deploy changed nothing

Cloudflare's uploader compares content hashes, so the deploy output tells you directly:

```
Uploaded 0 files (11 already uploaded)
```

Zero new uploads means every file you deployed is byte-identical to what was already live.
If instead all files are uploaded, something differs — check whether you intended to change
that many files.

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
use LF, so committing CRLF versions makes every file on the live site grow by a few dozen
bytes. `deploy.sh` strips `\r` before uploading, but prefer keeping the repository at LF
(`git config core.autocrlf false`, or a `.gitattributes`).

**The IndexNow key file has no trailing newline.** It is exactly the key, 32 bytes. Adding
a newline changes the deployed file; it still works, but then the repository and the live
site differ.

**`contact/index.html` and `privacy/index.html` do not match the live bytes.** Cloudflare's
edge injects email-obfuscation markup into pages containing an email address, adding about
239 bytes to each of those two responses. The files in this repository are the
pre-injection source; the difference is expected and is not drift.

**`_headers` is not a static asset.** Cloudflare Pages parses it and applies the headers,
and returns 404 for `/_headers` itself.

---

## License

No license is currently declared for the site content in this repository.
