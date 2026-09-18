/* Shared types for the Rescale engine modules. */

/** A decoded source image plus the metadata the UI needs. */
export interface SourceImage {
  el: HTMLImageElement;
  /** Object URL backing `el` — revoke it when the source is replaced. */
  url: string;
  name: string;
  type: string;
  /** Bytes of the original file, or 0 for generated images. */
  size: number;
  width: number;
  height: number;
}

export type ToolId = "resize" | "upscale" | "removebg";
export type ResizeMode = "dimensions" | "percent" | "presets";
export type FitMode = "contain" | "cover" | "stretch";
export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export type Rgb = [number, number, number];

export interface Dimensions {
  width: number;
  height: number;
}

export interface UpscaleOptions {
  scale: number;
  /** 0–100; mapped to an unsharp amount internally. */
  sharpen: number;
  denoise: boolean;
}

export interface BgRemoveOptions {
  /** Explicit key colour, or null to auto-sample the image border. */
  key: Rgb | null;
  tolerance: number;
  softness: number;
  connected: boolean;
  despill: boolean;
  fill: "transparent" | string;
}

/** Minimal ImageData-shaped buffer the pure passes work on. */
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
