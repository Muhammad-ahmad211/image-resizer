"use client";

import { formatBytes } from "@/lib/engine";
import type { Dimensions, SourceImage } from "@/lib/types";

interface ReadoutProps {
  source: SourceImage;
  target: Dimensions | null;
  blob: Blob | null;
}

export function Readout({ source, target, blob }: ReadoutProps) {
  const delta = describeDelta(source.size, blob?.size ?? null);

  return (
    <div className="readout">
      <div className="ro-col">
        <span>Original</span>
        <b>
          {source.width} × {source.height}
        </b>
        <i>{source.size ? formatBytes(source.size) : "generated"}</i>
      </div>
      <div className="ro-arrow">→</div>
      <div className="ro-col">
        <span>New</span>
        <b>{target ? `${target.width} × ${target.height}` : "—"}</b>
        <i>{blob ? formatBytes(blob.size) : "—"}</i>
      </div>
      <div className={delta.className}>{delta.text}</div>
    </div>
  );
}

function describeDelta(sourceSize: number, outputSize: number | null) {
  if (outputSize == null) return { text: "—", className: "ro-delta" };

  // A generated sample has no original file to compare against.
  if (!sourceSize) {
    return { text: `output ${formatBytes(outputSize)}`, className: "ro-delta" };
  }

  const diff = ((outputSize - sourceSize) / sourceSize) * 100;
  const rounded = Math.round(Math.abs(diff));

  if (rounded <= 0) return { text: "about the same file size", className: "ro-delta" };

  if (diff < 0) {
    return {
      text: `−${rounded}% smaller · saves ${formatBytes(sourceSize - outputSize)}`,
      className: "ro-delta is-down",
    };
  }

  return {
    text: `+${rounded}% larger · ${formatBytes(outputSize - sourceSize)} more`,
    className: "ro-delta is-up",
  };
}
