"use client";

import { useState } from "react";

import { Seg } from "../ui/Seg";
import type { BgState } from "@/hooks/useImageTool";
import type { Rgb } from "@/lib/types";

const NAMED_FILLS = ["transparent", "#ffffff", "#000000"];

interface CutoutPanelProps {
  bg: BgState;
  /** Eyedropped colour, or the one auto-detection settled on. */
  keySwatch: Rgb | null;
  onChange: (patch: Partial<BgState>) => void;
}

export function CutoutPanel({ bg, keySwatch, onChange }: CutoutPanelProps) {
  const [customColor, setCustomColor] = useState("#2f9e44");

  const isCustom = !NAMED_FILLS.includes(bg.fill);
  const selectValue = isCustom ? "custom" : bg.fill;

  return (
    <div className="tool-panel">
      <span className="block-label">Background colour</span>
      <Seg
        small
        label="Background colour source"
        value={bg.keyMode}
        onChange={(keyMode) => onChange({ keyMode })}
        options={[
          { value: "auto" as const, label: "Auto detect" },
          { value: "pick" as const, label: "Pick from image" },
        ]}
      />

      <div className="key-row">
        <span
          className="key-swatch"
          style={
            keySwatch
              ? { background: `rgb(${keySwatch[0]}, ${keySwatch[1]}, ${keySwatch[2]})` }
              : undefined
          }
        />
        <span className="from-note">
          {bg.keyMode === "pick"
            ? "click the image to sample a colour"
            : "sampled from the image edges"}
        </span>
      </div>

      <label className="field">
        <span>
          Tolerance <b>{bg.tolerance}</b>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={bg.tolerance}
          onChange={(e) => onChange({ tolerance: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>
          Edge softness <b>{bg.softness}</b>
        </span>
        <input
          type="range"
          min={0}
          max={8}
          value={bg.softness}
          onChange={(e) => onChange({ softness: Number(e.target.value) })}
        />
      </label>

      <label className="switch switch--row">
        <input
          type="checkbox"
          checked={bg.connected}
          onChange={(e) => onChange({ connected: e.target.checked })}
        />
        <span>Only remove areas touching the border</span>
      </label>

      <label className="switch switch--row">
        <input
          type="checkbox"
          checked={bg.despill}
          onChange={(e) => onChange({ despill: e.target.checked })}
        />
        <span>Clean colour fringe (despill)</span>
      </label>

      <label className="field">
        <span>Replace background with</span>
        <span className="fill-row">
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ fill: v === "custom" ? customColor : v });
            }}
          >
            <option value="transparent">Transparent</option>
            <option value="#ffffff">White</option>
            <option value="#000000">Black</option>
            <option value="custom">Custom…</option>
          </select>
          {isCustom && (
            <input
              type="color"
              aria-label="Custom background colour"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange({ fill: e.target.value });
              }}
            />
          )}
        </span>
      </label>
    </div>
  );
}
