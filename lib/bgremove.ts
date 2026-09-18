/* =========================================================
   Rescale — on-device background removal (colour-based).
   Border auto-sampling or eyedropper key colour, weighted
   colour-distance matte, edge-connected flood fill, alpha
   feather, and colour decontamination (despill).
   No models, no downloads.
   ========================================================= */

import { context2d } from "./engine";
import type { BgRemoveOptions, Rgb, SourceImage } from "./types";

/** Result of a cut-out pass: the canvas plus the key colour actually used. */
export interface BgRemoveResult {
  canvas: HTMLCanvasElement;
  key: Rgb;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Perceptually weighted RGB distance, 0..~100. */
function dist(r: number, g: number, b: number, kr: number, kg: number, kb: number): number {
  const dr = r - kr;
  const dg = g - kg;
  const db = b - kb;
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) / 2.55;
}

/** Median colour of the image border (auto key). */
function sampleBorder(d: Uint8ClampedArray, w: number, h: number): Rgb {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const step = Math.max(1, Math.floor((2 * (w + h)) / 800));

  const push = (i: number) => {
    rs.push(d[i]);
    gs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };

  for (let x = 0; x < w; x += step) {
    push(x * 4);
    push(((h - 1) * w + x) * 4);
  }
  for (let y = 0; y < h; y += step) {
    push(y * w * 4);
    push((y * w + (w - 1)) * 4);
  }

  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    return arr[arr.length >> 1];
  };

  return [med(rs), med(gs), med(bs)];
}

export function run(source: SourceImage, opts: BgRemoveOptions): BgRemoveResult {
  const w = source.width;
  const h = source.height;
  const n = w * h;

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = context2d(cv);
  ctx.drawImage(source.el, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const key = opts.key || sampleBorder(d, w, h);
  const [kr, kg, kb] = key;

  const tol = opts.tolerance ?? 30;
  const soft = opts.softness ?? 2;
  const e0 = tol; // fully background at/below
  const e1 = tol + (soft + 1) * 4; // fully foreground at/above

  // 1. Distance map + raw alpha from the matte.
  const dm = new Float32Array(n);
  const alpha = new Float32Array(n); // 0..1, 1 = keep
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const dd = dist(d[p], d[p + 1], d[p + 2], kr, kg, kb);
    dm[i] = dd;
    alpha[i] = smoothstep(e0, e1, dd);
    if (d[p + 3] < 255) alpha[i] *= d[p + 3] / 255; // respect existing transparency
  }

  // 2. Edge-connected flood fill: only remove background reachable from the
  //    image border, so same-coloured regions inside the subject survive.
  if (opts.connected !== false) {
    const candidate = new Uint8Array(n);
    for (let c = 0; c < n; c++) candidate[c] = dm[c] <= e1 ? 1 : 0;

    const reach = new Uint8Array(n);
    const stack: number[] = [];
    const pushIf = (idx: number) => {
      if (candidate[idx] && !reach[idx]) {
        reach[idx] = 1;
        stack.push(idx);
      }
    };

    for (let bx = 0; bx < w; bx++) {
      pushIf(bx);
      pushIf((h - 1) * w + bx);
    }
    for (let by = 0; by < h; by++) {
      pushIf(by * w);
      pushIf(by * w + w - 1);
    }

    while (stack.length) {
      const idx = stack.pop()!;
      const yy = (idx / w) | 0;
      const xx = idx - yy * w;
      if (xx > 0) pushIf(idx - 1);
      if (xx < w - 1) pushIf(idx + 1);
      if (yy > 0) pushIf(idx - w);
      if (yy < h - 1) pushIf(idx + w);
    }

    for (let m = 0; m < n; m++) if (!reach[m]) alpha[m] = 1; // not border-connected -> keep
  }

  // 3. Feather the alpha channel (small box blur) to kill jaggies.
  if (soft > 0) alpha.set(blurAlpha(alpha, w, h, Math.min(4, Math.round(soft))));

  // 4. Compose output with optional colour decontamination.
  const fill = opts.fill && opts.fill !== "transparent" ? hexToRgb(opts.fill) : null;
  const out = ctx.createImageData(w, h);
  const od = out.data;

  for (let q = 0, o = 0; q < n; q++, o += 4) {
    const a = alpha[q];
    let r = d[o];
    let g = d[o + 1];
    let bl = d[o + 2];

    if (opts.despill && a > 0.15 && a < 0.999) {
      // Un-mix: observed = a*fg + (1-a)*key  ->  fg = (observed - (1-a)*key) / a
      r = clamp((r - (1 - a) * kr) / a, 0, 255);
      g = clamp((g - (1 - a) * kg) / a, 0, 255);
      bl = clamp((bl - (1 - a) * kb) / a, 0, 255);
    }

    if (fill) {
      od[o] = r * a + fill[0] * (1 - a);
      od[o + 1] = g * a + fill[1] * (1 - a);
      od[o + 2] = bl * a + fill[2] * (1 - a);
      od[o + 3] = 255;
    } else {
      od[o] = r;
      od[o + 1] = g;
      od[o + 2] = bl;
      od[o + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(out, 0, 0);
  return { canvas: cv, key: [Math.round(kr), Math.round(kg), Math.round(kb)] };
}

function blurAlpha(alpha: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return alpha;

  const tmp = new Float32Array(alpha.length);
  const out = new Float32Array(alpha.length);
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += alpha[y * w + clamp(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * norm;
      acc += alpha[y * w + clamp(x + r + 1, 0, w - 1)] - alpha[y * w + clamp(x - r, 0, w - 1)];
    }
  }

  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[clamp(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }

  return out;
}

export function hexToRgb(hex: string): Rgb {
  let s = String(hex).replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const num = parseInt(s, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/* The eyedropper reads from a one-off copy of the source; cache it per image
   so repeated picks do not redraw the whole bitmap every click. */
const samplers = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

/** Read one pixel from the source (for the eyedropper). */
export function pickColor(source: SourceImage, x: number, y: number): Rgb {
  let c = samplers.get(source.el);
  if (!c) {
    c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    context2d(c).drawImage(source.el, 0, 0);
    samplers.set(source.el, c);
  }

  const px = context2d(c).getImageData(
    clamp(Math.round(x), 0, source.width - 1),
    clamp(Math.round(y), 0, source.height - 1),
    1,
    1,
  ).data;

  return [px[0], px[1], px[2]];
}
