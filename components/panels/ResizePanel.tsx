"use client";

import { useState } from "react";

import { LockedIcon, UnlockedIcon } from "../Icons";
import { Seg } from "../ui/Seg";
import { presetGroups } from "@/lib/presets";
import type { Dimensions, FitMode, ResizeMode, SourceImage } from "@/lib/types";

const MAX_DIM = 20000;
const PCT_CHIPS = [25, 50, 75, 100, 200];
const GROUPS = presetGroups();

interface ResizePanelProps {
  source: SourceImage;
  mode: ResizeMode;
  width: number;
  height: number;
  lockAspect: boolean;
  percent: number;
  presetIndex: number;
  fit: FitMode;
  showFit: boolean;
  target: Dimensions | null;
  onMode: (mode: ResizeMode) => void;
  onWidth: (value: number) => void;
  onHeight: (value: number) => void;
  onToggleLock: () => void;
  onPercent: (value: number) => void;
  onPreset: (index: number) => void;
  onFit: (fit: FitMode) => void;
}

export function ResizePanel(props: ResizePanelProps) {
  const {
    source,
    mode,
    width,
    height,
    lockAspect,
    percent,
    presetIndex,
    fit,
    showFit,
    target,
    onMode,
    onWidth,
    onHeight,
    onToggleLock,
    onPercent,
    onPreset,
    onFit,
  } = props;

  /* While a number field has focus it shows exactly what was typed; the
     committed value flows back in as soon as it is blurred. */
  const [draft, setDraft] = useState<{ w?: string; h?: string; pct?: string }>({});

  function commit(text: string, apply: (value: number) => void, max: number) {
    const n = parseInt(text, 10);
    if (Number.isNaN(n) || n < 1) return;
    apply(Math.min(n, max));
  }

  const targetLabel = target ? `${target.width} × ${target.height} px` : "—";

  return (
    <div className="tool-panel">
      <Seg
        label="Resize mode"
        tabs
        value={mode}
        onChange={onMode}
        options={[
          { value: "dimensions" as ResizeMode, label: "Dimensions" },
          { value: "percent" as ResizeMode, label: "Percent" },
          { value: "presets" as ResizeMode, label: "Presets" },
        ]}
      />

      {mode === "dimensions" && (
        <div className="mode-panel">
          <div className="dim-row">
            <label className="field">
              <span>Width</span>
              <span className="input-unit">
                <input
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  inputMode="numeric"
                  value={draft.w ?? String(width)}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, w: e.target.value }));
                    commit(e.target.value, onWidth, MAX_DIM);
                  }}
                  onBlur={() => setDraft((d) => ({ ...d, w: undefined }))}
                />
                <i>px</i>
              </span>
            </label>

            <button
              type="button"
              className={lockAspect ? "lock-btn is-locked" : "lock-btn"}
              title="Lock aspect ratio"
              aria-label="Lock aspect ratio"
              aria-pressed={lockAspect}
              onClick={onToggleLock}
            >
              <LockedIcon className="i-locked" />
              <UnlockedIcon className="i-open" />
            </button>

            <label className="field">
              <span>Height</span>
              <span className="input-unit">
                <input
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  inputMode="numeric"
                  value={draft.h ?? String(height)}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, h: e.target.value }));
                    commit(e.target.value, onHeight, MAX_DIM);
                  }}
                  onBlur={() => setDraft((d) => ({ ...d, h: undefined }))}
                />
                <i>px</i>
              </span>
            </label>
          </div>
          <p className="from-note">
            from original{" "}
            <b>
              {source.width} × {source.height} px
            </b>
          </p>
        </div>
      )}

      {mode === "percent" && (
        <div className="mode-panel">
          <div className="pct-head">
            <input
              type="range"
              min={1}
              max={400}
              value={percent}
              aria-label="Scale percentage"
              onChange={(e) => onPercent(Number(e.target.value))}
            />
            <span className="input-unit input-unit--sm">
              <input
                type="number"
                min={1}
                max={400}
                value={draft.pct ?? String(percent)}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, pct: e.target.value }));
                  commit(e.target.value, onPercent, 400);
                }}
                onBlur={() => setDraft((d) => ({ ...d, pct: undefined }))}
              />
              <i>%</i>
            </span>
          </div>

          <div className="chips">
            {PCT_CHIPS.map((value) => (
              <button
                key={value}
                type="button"
                className={value === percent ? "is-active" : undefined}
                onClick={() => onPercent(value)}
              >
                {value}%
              </button>
            ))}
          </div>

          <p className="from-note">
            result <b>{targetLabel}</b>
          </p>
        </div>
      )}

      {mode === "presets" && (
        <div className="mode-panel">
          <div className="preset-groups">
            {GROUPS.map((group) => (
              <div className="preset-group" key={group.name}>
                <div className="preset-group-label">{group.name}</div>
                <div className="preset-grid">
                  {group.items.map(({ preset, index }) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={index === presetIndex ? "preset-btn is-active" : "preset-btn"}
                      onClick={() => onPreset(index)}
                    >
                      <b>{preset.label}</b>
                      <i>
                        {preset.w} × {preset.h}
                      </i>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFit && (
        <div className="field-block">
          <span className="block-label">When proportions differ</span>
          <Seg
            small
            label="Fit mode"
            value={fit}
            onChange={onFit}
            options={[
              { value: "contain" as FitMode, label: "Fit" },
              { value: "cover" as FitMode, label: "Fill" },
              { value: "stretch" as FitMode, label: "Stretch" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
