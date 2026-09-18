/* =========================================================
   Rescale engine — image loading, resizing, encoding.
   Pure functions, no React and no DOM wiring. Everything is
   client-side; these must only run in the browser.
   ========================================================= */

import type { Dimensions, FitMode, OutputFormat, ResizeMode, SourceImage } from "./types";

const ACCEPTED = /^image\/(jpeg|png|webp|gif|bmp|avif)$/i;

/* ---- Loading ------------------------------------------------ */

export function loadFile(file: File): Promise<SourceImage> {
  if (!file || !file.type || !ACCEPTED.test(file.type)) {
    return Promise.reject(new Error("Unsupported file type."));
  }
  return decode(URL.createObjectURL(file), file.name, file.type, file.size);
}

export function loadBlob(blob: Blob, name?: string): Promise<SourceImage> {
  return decode(
    URL.createObjectURL(blob),
    name || "pasted-image.png",
    blob.type || "image/png",
    blob.size || 0,
  );
}

function decode(url: string, name: string, type: string, size: number): Promise<SourceImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      resolve({
        el: img,
        url,
        name,
        type,
        size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode this image."));
    };
    img.src = url;
  });
}

/* ---- Target computation ------------------------------------ */

export interface TargetInput {
  mode: ResizeMode;
  percent: number;
  width: number;
  height: number;
}

/** Resolve the requested output size for the current resize mode. */
export function computeTarget(input: TargetInput, source: Dimensions): Dimensions {
  let w: number;
  let h: number;

  if (input.mode === "percent") {
    const p = clamp(input.percent, 1, 1000) / 100;
    w = Math.round(source.width * p);
    h = Math.round(source.height * p);
  } else {
    // dimensions & presets both carry explicit w/h
    w = Math.round(input.width || source.width);
    h = Math.round(input.height || source.height);
  }

  return { width: Math.max(1, w), height: Math.max(1, h) };
}

export function aspectsDiffer(tw: number, th: number, sw: number, sh: number): boolean {
  if (!tw || !th || !sw || !sh) return false;
  return Math.abs(tw / th - sw / sh) > 0.01;
}

/* ---- Rendering ------------------------------------------- */

/**
 * Draw `source` into a canvas of exactly targetW x targetH.
 * fit: "contain" (letterbox) | "cover" (centre-crop) | "stretch" (distort)
 */
export function render(
  source: SourceImage,
  targetW: number,
  targetH: number,
  fit: FitMode,
  bgColor?: string | null,
): HTMLCanvasElement {
  targetW = Math.max(1, Math.round(targetW));
  targetH = Math.max(1, Math.round(targetH));

  const sw = source.width;
  const sh = source.height;

  // 1. Optionally crop the source (cover mode) into a work canvas.
  let work: CanvasImageSource = source.el;
  let workW = sw;
  let workH = sh;

  if (fit === "cover" && aspectsDiffer(targetW, targetH, sw, sh)) {
    const scale = Math.max(targetW / sw, targetH / sh);
    const cropW = Math.round(targetW / scale);
    const cropH = Math.round(targetH / scale);
    const cropX = Math.round((sw - cropW) / 2);
    const cropY = Math.round((sh - cropH) / 2);
    const cc = document.createElement("canvas");
    cc.width = cropW;
    cc.height = cropH;
    context2d(cc).drawImage(source.el, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    work = cc;
    workW = cropW;
    workH = cropH;
  }

  // 2. Decide where the content sits inside the target canvas.
  let drawW: number;
  let drawH: number;
  let offX: number;
  let offY: number;

  if (fit === "contain") {
    const s = Math.min(targetW / workW, targetH / workH);
    drawW = Math.round(workW * s);
    drawH = Math.round(workH * s);
    offX = Math.round((targetW - drawW) / 2);
    offY = Math.round((targetH - drawH) / 2);
  } else {
    // cover (already cropped to aspect) and stretch both fill fully
    drawW = targetW;
    drawH = targetH;
    offX = 0;
    offY = 0;
  }

  // 3. Progressive halving for large downscales — much cleaner result.
  const stepped = steppedDownscale(work, workW, workH, drawW, drawH);

  // 4. Compose final canvas.
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(stepped.src, 0, 0, stepped.width, stepped.height, offX, offY, drawW, drawH);
  return canvas;
}

function steppedDownscale(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): { src: CanvasImageSource; width: number; height: number } {
  let curW = sw;
  let curH = sh;
  let cur = src;

  // Only step while we are still more than 2x larger than the target.
  while (curW > dw * 2 && curH > dh * 2) {
    const nextW = Math.max(Math.round(curW / 2), dw);
    const nextH = Math.max(Math.round(curH / 2), dh);
    const c = document.createElement("canvas");
    c.width = nextW;
    c.height = nextH;
    const cx = context2d(c);
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(cur, 0, 0, curW, curH, 0, 0, nextW, nextH);
    cur = c;
    curW = nextW;
    curH = nextH;
  }

  return { src: cur, width: curW, height: curH };
}

/* ---- Encoding ----------------------------------------------- */

/** Encode a canvas, falling back to PNG when the format is unsupported. */
export function encode(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const q = format === "image/png" ? undefined : clamp(quality, 0.05, 1);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // The browser may silently produce a different type (e.g. no WebP
          // encoder); the caller compares blob.type and warns.
          resolve(blob);
          return;
        }
        canvas.toBlob(
          (png) => (png ? resolve(png) : reject(new Error("Encoding failed."))),
          "image/png",
        );
      },
      format,
      q,
    );
  });
}

/* ---- Helpers ---------------------------------------------- */

export function clamp(n: number, lo: number, hi: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
}

/** 2D context with a clear error instead of a null deref. */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
  return ctx;
}

/** A self-contained demo image so "Try a sample" needs no network. */
export function makeSample(w = 1600, h = 1000): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = context2d(c);

  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#f2683c");
  g.addColorStop(0.55, "#c8407a");
  g.addColorStop(1, "#3b2a8c");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  x.globalAlpha = 0.14;
  x.strokeStyle = "#fff";
  x.lineWidth = 2;
  for (let i = -h; i < w; i += 46) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + h, h);
    x.stroke();
  }
  x.globalAlpha = 1;

  x.fillStyle = "rgba(255,255,255,0.92)";
  for (let j = 0; j < 5; j++) {
    x.beginPath();
    x.arc(w * (0.12 + j * 0.19), h * (0.3 + (j % 2) * 0.34), 34 + j * 10, 0, Math.PI * 2);
    x.fill();
  }

  x.fillStyle = "#fff";
  x.font = `700 ${Math.round(h * 0.11)}px 'Space Grotesk', sans-serif`;
  x.textBaseline = "middle";
  x.fillText("RESCALE", w * 0.08, h * 0.82);
  x.font = `500 ${Math.round(h * 0.038)}px Inter, sans-serif`;
  x.fillText(`${w} × ${h}  sample`, w * 0.08, h * 0.92);

  return c;
}
