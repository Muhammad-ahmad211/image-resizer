# Rescale

A privacy-first image tool that runs **entirely in the browser**. No uploads, no
servers, no tracking — every pixel is processed locally with the Canvas API.

Inspired by imageresizer.com, with its own "darkroom" UI.

## Features

Three tools share one workspace (preview, output format, download):

### Resize
- **By dimensions** — width/height in pixels with an aspect-ratio lock.
- **By percent** — slider + input, with 25 / 50 / 75 / 100 / 200 % quick chips.
- **Preset sizes** — screen resolutions, social-media formats, avatars/icons
  (edit `js/presets.js` to add your own).
- **Fit modes** when the target proportions differ: **Fit** (letterbox),
  **Fill** (center-crop), **Stretch**.
- **Progressive downscaling** for clean results on large reductions.

### Upscale
- **2× / 3× / 4×** Lanczos-3 separable resampling (`js/upscale.js`).
- **Sharpen** — unsharp-mask pass, 0–100.
- **Reduce noise** — optional 3×3 median pre-pass.
- Fully offline, no model download. Large factors run for a few seconds on the
  main thread (a spinner shows); output is capped at 40 MP.

### Cut out (background removal)
- Colour-key matte (`js/bgremove.js`): **Auto detect** samples the image border,
  or **Pick from image** to eyedrop the background colour off the canvas.
- **Tolerance** and **Edge softness** sliders.
- **Only remove areas touching the border** — edge-connected flood fill so
  same-coloured regions inside the subject are kept.
- **Despill** — colour decontamination on partial-alpha edge pixels.
- Replace the background with **transparent**, white, black, or a custom colour.
  Transparent output forces an alpha format (PNG/WebP).
- Best on plain / gradient backgrounds; not an AI segmenter — fine hair and busy
  scenes need manual tuning.

### Shared
- Export as JPG, PNG, or WebP with a quality slider.
- Live preview with on-canvas dimension badges and a real, encoded before/after
  file-size comparison.
- Drag & drop anywhere, paste from clipboard (`Ctrl`/`Cmd`+`V`), copy result to
  clipboard, one sample image generated offline.
- Light / dark theme (follows the OS, with a manual toggle).
- Optional left/right ad rails (`.ad-rail`) that appear at ≥1240px — markup and
  commented AdSense snippets are in `index.html`.

## Run it

No build step, no dependencies. Either:

- **Double-click `index.html`** — it works straight from `file://`.
- Or serve the folder for a cleaner setup:
  ```
  npx serve .
  # or
  python -m http.server
  ```
  then open the printed URL.

## Project layout

```
index.html          markup, SEO <head>, JSON-LD, indexable copy
css/styles.css       theme tokens + all styling
js/presets.js        preset size list (data only)
js/engine.js         load / resize / encode         — pure, DOM-free
js/upscale.js        Lanczos resample + unsharp + median  — pure, DOM-free
js/bgremove.js       colour-key matte + flood fill + despill — pure, DOM-free
js/app.js            UI controller, state, event wiring, tool switching
favicon.svg          icon (also used by the manifest)
site.webmanifest     PWA metadata
robots.txt           crawler directives + sitemap pointer
sitemap.xml          one URL entry
```

## SEO

Built in:

- Keyword-tuned `<title>` + meta description, `canonical`, `robots`,
  Open Graph and Twitter Card tags, `theme-color`, and a web manifest.
- **JSON-LD**: `WebApplication` and `FAQPage` (the FAQ markup mirrors the
  visible FAQ text, as Google requires).
- One visible `<h1>` plus an ~700-word indexable article below the tool:
  how-to steps, feature sections, a privacy section, and 8 FAQs targeting
  long-tail queries ("resize image to a specific file size", "remove a white
  background", "make an image larger without blur", …).
- Semantic headings (single `h1` → `h2` → `h3`), `scroll-behavior: smooth`
  with a reduced-motion guard, non-render-blocking font load.
- The tool stays roughly one screen tall; the copy follows below the fold.

**Before you deploy, replace the placeholders:**

| Placeholder | Where | Replace with |
|---|---|---|
| `https://example.com/` | `index.html` (canonical, OG/Twitter URLs, JSON-LD), `robots.txt`, `sitemap.xml` | your real https domain |
| `og-cover.png` | `index.html` OG/Twitter `image` | a real **1200×630 PNG/JPG** placed at the site root |
| `<lastmod>` | `sitemap.xml` | the date you publish |
| `ca-pub-XXXX…` | `index.html` AdSense comments | your AdSense publisher ID (only if using ads) |

Also recommended for ranking:

- Serve over **HTTPS** with HTTP/2, gzip/brotli, and long `Cache-Control` on
  `css/` + `js/`.
- **Self-host the two fonts** (both SIL OFL) to remove the last third-party
  request and match the "no tracking" claim.
- Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Run Lighthouse; the app is built to score well on Core Web Vitals (ad rails
  reserve their space, so no layout shift).

## Extending

The engine modules are deliberately UI-agnostic so more tools can be layered on:

- **Crop / rotate / flip** — add a transform step before `Engine.render()`.
- **Batch** — loop the per-tool `run` + `Engine.encode` over a file array and zip
  the blobs (e.g. with JSZip).
- **AI upscale / segmentation** — swap `Upscale.run` / `BgRemove.run` for a
  lazy-loaded model while keeping the same call sites.

## Browser support

Modern Chrome, Edge, Firefox, and Safari. WebP export depends on the browser's
canvas encoder; if it's missing, Rescale falls back to PNG and tells you.
