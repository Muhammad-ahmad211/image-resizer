"use client";

import { Seg } from "../ui/Seg";
import type { Dimensions, UpscaleOptions } from "@/lib/types";

interface UpscalePanelProps {
  up: UpscaleOptions;
  target: Dimensions | null;
  onChange: (patch: Partial<UpscaleOptions>) => void;
}

export function UpscalePanel({ up, target, onChange }: UpscalePanelProps) {
  return (
    <div className="tool-panel">
      <span className="block-label">Scale factor</span>
      <Seg
        small
        label="Scale factor"
        value={up.scale}
        onChange={(scale) => onChange({ scale })}
        options={[
          { value: 2, label: "2×" },
          { value: 3, label: "3×" },
          { value: 4, label: "4×" },
        ]}
      />

      <label className="field">
        <span>
          Sharpen <b>{up.sharpen}</b>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={up.sharpen}
          onChange={(e) => onChange({ sharpen: Number(e.target.value) })}
        />
      </label>

      <label className="switch switch--row">
        <input
          type="checkbox"
          checked={up.denoise}
          onChange={(e) => onChange({ denoise: e.target.checked })}
        />
        <span>Reduce noise before upscaling</span>
      </label>

      <p className="from-note">
        output <b>{target ? `${target.width} × ${target.height} px` : "—"}</b> · Lanczos-3
        resampling
      </p>
    </div>
  );
}
