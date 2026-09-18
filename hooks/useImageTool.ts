"use client";

/* =========================================================
   The Rescale controller: all tool state, plus the debounced
   render -> encode pipeline that feeds the preview.
   ========================================================= */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import * as BgRemove from "@/lib/bgremove";
import * as Engine from "@/lib/engine";
import * as Upscale from "@/lib/upscale";
import { outputFilename } from "@/lib/filename";
import { PRESETS } from "@/lib/presets";
import type {
  BgRemoveOptions,
  Dimensions,
  FitMode,
  OutputFormat,
  ResizeMode,
  Rgb,
  SourceImage,
  ToolId,
  UpscaleOptions,
} from "@/lib/types";

/** Resize output bigger than this is refused outright. */
const MAX_RESIZE_PIXELS = 120_000_000;
/** Upscale output bigger than this is refused outright. */
const MAX_UPSCALE_PIXELS = 40_000_000;
/** Debounce before a render starts, and how long before the spinner shows. */
const RENDER_DELAY = 110;
const BUSY_DELAY = 170;

export interface BgState extends BgRemoveOptions {
  keyMode: "auto" | "pick";
}

const UP_DEFAULTS: UpscaleOptions = { scale: 2, sharpen: 40, denoise: false };
const BG_DEFAULTS: BgState = {
  keyMode: "auto",
  key: null,
  tolerance: 30,
  softness: 2,
  connected: true,
  despill: true,
  fill: "transparent",
};

interface State {
  source: SourceImage | null;
  tool: ToolId;
  mode: ResizeMode;
  width: number;
  height: number;
  lockAspect: boolean;
  percent: number;
  presetIndex: number;
  fit: FitMode;
  format: OutputFormat;
  /** 0..1, as the canvas encoder wants it. */
  quality: number;
  up: UpscaleOptions;
  bg: BgState;
}

const INITIAL: State = {
  source: null,
  tool: "resize",
  mode: "dimensions",
  width: 0,
  height: 0,
  lockAspect: true,
  percent: 100,
  presetIndex: -1,
  fit: "contain",
  format: "image/jpeg",
  quality: 0.85,
  up: { ...UP_DEFAULTS },
  bg: { ...BG_DEFAULTS },
};

type Action =
  | { type: "load"; source: SourceImage; tool?: ToolId | null }
  | { type: "clear" }
  | { type: "reset" }
  | { type: "tool"; tool: ToolId }
  | { type: "mode"; mode: ResizeMode }
  | { type: "width"; value: number }
  | { type: "height"; value: number }
  | { type: "toggleLock" }
  | { type: "percent"; value: number }
  | { type: "preset"; index: number }
  | { type: "fit"; fit: FitMode }
  | { type: "format"; format: OutputFormat }
  | { type: "quality"; value: number }
  | { type: "up"; patch: Partial<UpscaleOptions> }
  | { type: "bg"; patch: Partial<BgState> };

/** Cutting out to transparency needs an alpha-capable format. */
function needsAlpha(state: State): boolean {
  return state.tool === "removebg" && state.bg.fill === "transparent";
}

/** Swap JPG for PNG when the current settings require transparency. */
function enforceFormat(state: State): State {
  if (needsAlpha(state) && state.format === "image/jpeg") {
    return { ...state, format: "image/png" };
  }
  return state;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return enforceFormat({
        ...INITIAL,
        format: state.format,
        quality: state.quality,
        source: action.source,
        tool: action.tool || "resize",
        width: action.source.width,
        height: action.source.height,
        up: { ...UP_DEFAULTS },
        bg: { ...BG_DEFAULTS },
      });

    case "clear":
      return { ...INITIAL, format: state.format, quality: state.quality };

    case "reset":
      if (!state.source) return state;
      return {
        ...INITIAL,
        source: state.source,
        width: state.source.width,
        height: state.source.height,
        up: { ...UP_DEFAULTS },
        bg: { ...BG_DEFAULTS },
      };

    case "tool":
      return enforceFormat({ ...state, tool: action.tool });

    case "mode": {
      // Entering Percent, seed the slider from the dimensions already set.
      if (action.mode === "percent" && state.source) {
        const percent = Engine.clamp(
          Math.round((state.width / state.source.width) * 100),
          1,
          400,
        );
        return { ...state, mode: action.mode, percent };
      }
      return { ...state, mode: action.mode };
    }

    case "width": {
      const width = action.value;
      const height =
        state.lockAspect && state.source
          ? Math.max(1, Math.round((width * state.source.height) / state.source.width))
          : state.height;
      return { ...state, width, height, presetIndex: -1 };
    }

    case "height": {
      const height = action.value;
      const width =
        state.lockAspect && state.source
          ? Math.max(1, Math.round((height * state.source.width) / state.source.height))
          : state.width;
      return { ...state, width, height, presetIndex: -1 };
    }

    case "toggleLock": {
      const lockAspect = !state.lockAspect;
      if (lockAspect && state.source) {
        return {
          ...state,
          lockAspect,
          height: Math.max(
            1,
            Math.round((state.width * state.source.height) / state.source.width),
          ),
        };
      }
      return { ...state, lockAspect };
    }

    case "percent":
      return { ...state, percent: Engine.clamp(Math.round(action.value), 1, 400) };

    case "preset": {
      const preset = PRESETS[action.index];
      if (!preset) return state;
      return { ...state, presetIndex: action.index, width: preset.w, height: preset.h };
    }

    case "fit":
      return { ...state, fit: action.fit };

    case "format":
      return { ...state, format: action.format };

    case "quality":
      return { ...state, quality: action.value };

    case "up":
      return { ...state, up: { ...state.up, ...action.patch } };

    case "bg": {
      const bg = { ...state.bg, ...action.patch };
      // Switching back to auto detection drops any eyedropped colour.
      if (action.patch.keyMode === "auto") bg.key = null;
      return enforceFormat({ ...state, bg });
    }

    default:
      return state;
  }
}

export interface Output {
  blob: Blob;
  url: string;
  target: Dimensions;
}

export function useImageTool(notify: (message: string) => void) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [output, setOutput] = useState<Output | null>(null);
  const [busy, setBusy] = useState(false);
  /** Key colour the auto-detector settled on, for the swatch. */
  const [detectedKey, setDetectedKey] = useState<Rgb | null>(null);

  const runIdRef = useRef(0);
  const outputUrlRef = useRef<string | null>(null);
  const prevSourceRef = useRef<SourceImage | null>(null);
  /* Held in a ref so an unstable `notify` never restarts the render pipeline. */
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  /* ---- Object-URL hygiene ------------------------------- */

  useEffect(() => {
    const prev = prevSourceRef.current;
    if (prev && prev !== state.source) {
      URL.revokeObjectURL(prev.url);
    }
    prevSourceRef.current = state.source;
  }, [state.source]);

  const publishOutput = useCallback((next: Output | null) => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = next ? next.url : null;
    setOutput(next);
  }, []);

  /* ---- Loading ------------------------------------------ */

  const loadSource = useCallback(
    (source: SourceImage, tool?: ToolId | null) => {
      publishOutput(null);
      setDetectedKey(null);
      dispatch({ type: "load", source, tool });
    },
    [publishOutput],
  );

  const openFiles = useCallback(
    (files: FileList | File[] | null, tool?: ToolId | null) => {
      if (!files || !files.length) return;
      const list = Array.from(files);
      const file = list.find((f) => f.type && f.type.startsWith("image/"));
      if (!file) {
        notifyRef.current("That doesn't look like an image.");
        return;
      }
      Engine.loadFile(file)
        .then((source) => loadSource(source, tool))
        .catch((err: Error) => notifyRef.current(err.message));
    },
    [loadSource],
  );

  const loadSample = useCallback(() => {
    const canvas = Engine.makeSample(1600, 1000);
    canvas.toBlob((blob) => {
      if (!blob) {
        notifyRef.current("Couldn't generate the sample image.");
        return;
      }
      Engine.loadBlob(blob, "rescale-sample.png")
        .then((source) => loadSource(source))
        .catch((err: Error) => notifyRef.current(err.message));
    }, "image/png");
  }, [loadSource]);

  const clearSource = useCallback(() => {
    runIdRef.current++; // orphan any render in flight
    publishOutput(null);
    setDetectedKey(null);
    setBusy(false);
    dispatch({ type: "clear" });
  }, [publishOutput]);

  /* ---- Derived values ----------------------------------- */

  const { source, tool, mode, width, height, percent, fit, format, quality, up, bg } = state;

  /** The size this tool is asking for, before any clamping. */
  const target = useMemo<Dimensions | null>(() => {
    if (!source) return null;
    if (tool === "upscale") {
      return {
        width: Math.round(source.width * up.scale),
        height: Math.round(source.height * up.scale),
      };
    }
    if (tool === "removebg") {
      return { width: source.width, height: source.height };
    }
    return Engine.computeTarget({ mode, percent, width, height }, source);
  }, [source, tool, mode, percent, width, height, up.scale]);

  /** Fit controls only matter when the target changes the proportions. */
  const showFit = useMemo(() => {
    if (!source || !target || tool !== "resize") return false;
    return Engine.aspectsDiffer(target.width, target.height, source.width, source.height);
  }, [source, target, tool]);

  /* ---- Render pipeline ---------------------------------- */

  useEffect(() => {
    if (!source || !target) return;

    const runId = ++runIdRef.current;
    const stale = () => runId !== runIdRef.current;

    const busyTimer = setTimeout(() => setBusy(true), BUSY_DELAY);

    const renderTimer = setTimeout(async () => {
      const finish = () => {
        clearTimeout(busyTimer);
        if (!stale()) setBusy(false);
      };

      let canvas: HTMLCanvasElement;

      try {
        if (tool === "resize") {
          if (target.width * target.height > MAX_RESIZE_PIXELS) {
            finish();
            notifyRef.current("That target size is too large to render.");
            return;
          }
          const differ = Engine.aspectsDiffer(
            target.width,
            target.height,
            source.width,
            source.height,
          );
          canvas = Engine.render(
            source,
            target.width,
            target.height,
            differ ? fit : "stretch",
            format === "image/jpeg" ? "#ffffff" : null,
          );
        } else {
          if (tool === "upscale" && target.width * target.height > MAX_UPSCALE_PIXELS) {
            finish();
            notifyRef.current("Upscaled size would exceed 40 MP — try a smaller factor.");
            return;
          }

          // Upscale / cut-out block the main thread for a while: show the
          // spinner and let the browser paint it before starting.
          clearTimeout(busyTimer);
          setBusy(true);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => setTimeout(resolve, 0)),
          );
          if (stale()) return;

          if (tool === "upscale") {
            canvas = Upscale.run(source, up);
          } else {
            const result = BgRemove.run(source, bg);
            canvas = result.canvas;
            if (bg.keyMode === "auto") setDetectedKey(result.key);
          }
        }
      } catch (err) {
        finish();
        notifyRef.current(`Processing failed: ${(err as Error).message}`);
        return;
      }

      try {
        const blob = await Engine.encode(canvas, format, quality);
        if (stale()) return;

        publishOutput({ blob, url: URL.createObjectURL(blob), target });

        if (format === "image/webp" && blob.type !== "image/webp") {
          notifyRef.current(
            `WebP export isn't available here — saved as ${blob.type.split("/")[1]?.toUpperCase() ?? "PNG"}.`,
          );
        }
      } catch (err) {
        notifyRef.current(`Encoding failed: ${(err as Error).message}`);
      } finally {
        finish();
      }
    }, RENDER_DELAY);

    return () => {
      clearTimeout(busyTimer);
      clearTimeout(renderTimer);
    };
    // `target` is memoised, so this re-runs exactly when an input changes.
  }, [source, target, tool, fit, format, quality, up, bg, publishOutput]);

  /* ---- Actions ------------------------------------------ */

  const pickKeyAt = useCallback(
    (x: number, y: number) => {
      if (!source) return;
      const key = BgRemove.pickColor(source, x, y);
      setDetectedKey(key);
      dispatch({ type: "bg", patch: { key } });
    },
    [source],
  );

  const download = useCallback(() => {
    if (!output) return;
    const a = document.createElement("a");
    a.href = output.url;
    a.download = filenameFor(state, output);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [output, state]);

  const copy = useCallback(async () => {
    if (!output) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      notifyRef.current("Clipboard copy isn't supported in this browser.");
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [output.blob.type]: output.blob }),
      ]);
      notifyRef.current("Copied image to clipboard.");
    } catch {
      notifyRef.current("Couldn't copy — try downloading instead.");
    }
  }, [output]);

  return {
    state,
    dispatch,
    output,
    busy,
    target,
    showFit,
    needsAlpha: needsAlpha(state),
    /** Colour shown in the cut-out swatch: eyedropped, else auto-detected. */
    keySwatch: bg.key ?? detectedKey,
    openFiles,
    loadSample,
    clearSource,
    pickKeyAt,
    download,
    copy,
  };
}

function filenameFor(state: State, output: Output): string {
  return outputFilename(
    state.source?.name,
    output.target,
    state.tool,
    output.blob.type || state.format,
    state.up.scale,
  );
}

/** Everything the panel components need, in one object. */
export type ImageTool = ReturnType<typeof useImageTool>;
