"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Dimensions, SourceImage } from "@/lib/types";

interface StageProps {
  source: SourceImage;
  /** Object URL of the encoded result, or null while the first render runs. */
  previewUrl: string | null;
  target: Dimensions | null;
  busy: boolean;
  picking: boolean;
  onPick: (x: number, y: number) => void;
}

export function Stage({ source, previewUrl, target, busy, picking, onPick }: StageProps) {
  const previewRef = useRef<HTMLImageElement>(null);
  const [actualSize, setActualSize] = useState(false);
  /** How large the preview is drawn, as a percentage of its own pixels. */
  const [scalePct, setScalePct] = useState<number | null>(null);

  const measure = useCallback(() => {
    const img = previewRef.current;
    if (!img || !img.naturalWidth) {
      setScalePct(null);
      return;
    }
    // #preview shrink-wraps the visible image, so its box is the drawn size.
    const pct = Math.round((img.getBoundingClientRect().width / img.naturalWidth) * 100);
    setScalePct(Number.isFinite(pct) && pct > 0 ? pct : null);
  }, []);

  /* The observer covers window resizes, layout shifts and the actual-pixels
     toggle in one subscription. */
  useEffect(() => {
    const img = previewRef.current;
    if (!img) return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  }, [measure]);

  const hint = actualSize
    ? "100% · actual pixels"
    : scalePct
      ? `preview ≈ ${scalePct}%`
      : "fit to view";

  /* Eyedropper: the preview box maps straight onto source coordinates. */
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!picking) return;
    const img = previewRef.current;
    if (!img) return;

    const box = img.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right) return;
    if (e.clientY < box.top || e.clientY > box.bottom) return;

    onPick(
      ((e.clientX - box.left) / box.width) * source.width,
      ((e.clientY - box.top) / box.height) * source.height,
    );
  }

  const stageClass = ["stage-canvas", actualSize && "actual", picking && "picking"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="stage">
      <div className={stageClass} onClick={handleClick}>
        <div className="checker" aria-hidden="true" />
        <div className="preview-box">
          {/* Blob URL of a locally encoded canvas — next/image cannot optimise
              it and would only sit between the result and the screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="preview"
            ref={previewRef}
            src={previewUrl ?? undefined}
            alt="Resized preview"
            onLoad={measure}
          />
        </div>
        <div className="dim-badge dim-badge--w">{target ? `${target.width} px` : "—"}</div>
        <div className="dim-badge dim-badge--h">{target ? `${target.height} px` : "—"}</div>
        {busy && (
          <div className="stage-busy">
            <span className="spinner" />
          </div>
        )}
      </div>

      <div className="stage-bar">
        <label className="switch">
          <input
            type="checkbox"
            checked={actualSize}
            onChange={(e) => setActualSize(e.target.checked)}
          />
          <span>Actual pixels</span>
        </label>
        <span className="stage-hint">{hint}</span>
      </div>
    </div>
  );
}
