/* =========================================================
   Rescale — on-device upscaler.
   Lanczos-3 separable resampling + unsharp mask + optional
   3x3 median denoise. No models, no downloads.
   ========================================================= */

import { context2d } from "./engine";
import type { PixelBuffer, SourceImage, UpscaleOptions } from "./types";

const A = 3; // Lanczos lobes

function sinc(x: number): number {
  if (x === 0) return 1;
  const p = Math.PI * x;
  return Math.sin(p) / p;
}

function lanczos(x: number): number {
  if (x <= -A || x >= A) return 0;
  return sinc(x) * sinc(x / A);
}

interface Taps {
  idx: Int32Array;
  wgt: Float32Array;
  taps: number;
}

/** Precompute contributor indices + weights for one axis. */
function buildTaps(srcLen: number, dstLen: number): Taps {
  const scale = dstLen / srcLen;
  const support = scale < 1 ? A / scale : A; // low-pass when shrinking
  const winRadius = Math.ceil(support);
  const taps = winRadius * 2 + 1;
  const idx = new Int32Array(dstLen * taps);
  const wgt = new Float32Array(dstLen * taps);

  for (let d = 0; d < dstLen; d++) {
    const center = (d + 0.5) / scale - 0.5;
    const start = Math.floor(center - support + 0.5);
    const base = d * taps;
    let sum = 0;

    for (let t = 0; t < taps; t++) {
      const s = start + t;
      const dist = (center - s) * (scale < 1 ? scale : 1);
      const w = lanczos(dist);
      const cs = s < 0 ? 0 : s >= srcLen ? srcLen - 1 : s; // clamp edges
      idx[base + t] = cs;
      wgt[base + t] = w;
      sum += w;
    }

    if (sum !== 0) {
      for (let k = 0; k < taps; k++) wgt[base + k] /= sum;
    }
  }

  return { idx, wgt, taps };
}

/** Separable Lanczos resample of an ImageData-shaped buffer. */
export function resample(src: PixelBuffer, dstW: number, dstH: number): PixelBuffer {
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;

  const hx = buildTaps(sw, dstW);
  const vy = buildTaps(sh, dstH);

  // Horizontal pass -> Float32 buffer (dstW x sh x 4)
  const mid = new Float32Array(dstW * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srow = y * sw * 4;
    const mrow = y * dstW * 4;
    for (let x = 0; x < dstW; x++) {
      const hb = x * hx.taps;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let t = 0; t < hx.taps; t++) {
        const w = hx.wgt[hb + t];
        if (w === 0) continue;
        const si = srow + hx.idx[hb + t] * 4;
        r += sd[si] * w;
        g += sd[si + 1] * w;
        b += sd[si + 2] * w;
        a += sd[si + 3] * w;
      }
      const mi = mrow + x * 4;
      mid[mi] = r;
      mid[mi + 1] = g;
      mid[mi + 2] = b;
      mid[mi + 3] = a;
    }
  }

  // Vertical pass -> Uint8ClampedArray (dstW x dstH x 4)
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const vb = y * vy.taps;
    const orow = y * dstW * 4;
    for (let x = 0; x < dstW; x++) {
      const col = x * 4;
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let t = 0; t < vy.taps; t++) {
        const wv = vy.wgt[vb + t];
        if (wv === 0) continue;
        const mi = vy.idx[vb + t] * dstW * 4 + col;
        rr += mid[mi] * wv;
        gg += mid[mi + 1] * wv;
        bb += mid[mi + 2] * wv;
        aa += mid[mi + 3] * wv;
      }
      const oi = orow + col;
      out[oi] = rr;
      out[oi + 1] = gg;
      out[oi + 2] = bb;
      out[oi + 3] = aa;
    }
  }

  return { data: out, width: dstW, height: dstH };
}

/* ---- 3x3 median denoise (per channel, RGB) ---- */

function median3(img: PixelBuffer): PixelBuffer {
  const w = img.width;
  const h = img.height;
  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  out.set(d);
  const win = new Uint8Array(9);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            win[n++] = d[((y + dy) * w + (x + dx)) * 4 + ch];
          }
        }
        // insertion sort of 9
        for (let i = 1; i < 9; i++) {
          const v = win[i];
          let j = i - 1;
          while (j >= 0 && win[j] > v) {
            win[j + 1] = win[j];
            j--;
          }
          win[j + 1] = v;
        }
        out[o + ch] = win[4];
      }
    }
  }

  return { data: out, width: w, height: h };
}

/* ---- Unsharp mask ---- */

/** Separable box blur on RGB; alpha is copied through. */
function boxBlur(src: PixelBuffer, radius: number): PixelBuffer {
  const w = src.width;
  const h = src.height;
  const d = src.data;
  const tmp = new Float32Array(w * h * 3);
  const out = new Uint8ClampedArray(d.length);
  const r = radius;
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < h; y++) {
    for (let ch = 0; ch < 3; ch++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += d[(y * w + clamp(i, 0, w - 1)) * 4 + ch];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + ch] = acc * norm;
        const add = d[(y * w + clamp(x + r + 1, 0, w - 1)) * 4 + ch];
        const sub = d[(y * w + clamp(x - r, 0, w - 1)) * 4 + ch];
        acc += add - sub;
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let ch = 0; ch < 3; ch++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += tmp[(clamp(i, 0, h - 1) * w + x) * 3 + ch];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + ch] = acc * norm;
        const add = tmp[(clamp(y + r + 1, 0, h - 1) * w + x) * 3 + ch];
        const sub = tmp[(clamp(y - r, 0, h - 1) * w + x) * 3 + ch];
        acc += add - sub;
      }
    }
  }

  for (let i = 3; i < d.length; i += 4) out[i] = d[i];
  return { data: out, width: w, height: h };
}

export function unsharp(img: PixelBuffer, amount: number, radius = 2): PixelBuffer {
  if (amount <= 0) return img;

  const blur = boxBlur(img, radius);
  const d = img.data;
  const b = blur.data;
  const out = new Uint8ClampedArray(d.length);

  for (let i = 0; i < d.length; i += 4) {
    out[i] = d[i] + amount * (d[i] - b[i]);
    out[i + 1] = d[i + 1] + amount * (d[i + 1] - b[i + 1]);
    out[i + 2] = d[i + 2] + amount * (d[i + 2] - b[i + 2]);
    out[i + 3] = d[i + 3];
  }

  return { data: out, width: img.width, height: img.height };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ---- Public: run the full upscale pipeline ---- */

export function run(source: SourceImage, opts: UpscaleOptions): HTMLCanvasElement {
  const scale = opts.scale || 2;
  const dstW = Math.round(source.width * scale);
  const dstH = Math.round(source.height * scale);

  const pre = document.createElement("canvas");
  pre.width = source.width;
  pre.height = source.height;
  const pctx = context2d(pre);
  pctx.drawImage(source.el, 0, 0);

  const raw = pctx.getImageData(0, 0, source.width, source.height);
  let img: PixelBuffer = { data: raw.data, width: raw.width, height: raw.height };

  if (opts.denoise) img = median3(img);

  let big = resample(img, dstW, dstH);

  const amount = ((opts.sharpen || 0) / 100) * 1.4;
  if (amount > 0) {
    const rad = dstW * dstH > 6_000_000 ? 2 : 1;
    big = unsharp(big, amount, rad);
  }

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  context2d(canvas).putImageData(
    new ImageData(new Uint8ClampedArray(big.data), dstW, dstH),
    0,
    0,
  );
  return canvas;
}
