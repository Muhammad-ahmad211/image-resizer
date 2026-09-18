"use client";

import { DownloadIcon, ToolIcon } from "./Icons";
import { Readout } from "./Readout";
import { CutoutPanel } from "./panels/CutoutPanel";
import { ResizePanel } from "./panels/ResizePanel";
import { UpscalePanel } from "./panels/UpscalePanel";
import type { ImageTool } from "@/hooks/useImageTool";
import type { OutputFormat, ToolId } from "@/lib/types";

const TOOLS: { id: ToolId; label: string }[] = [
  { id: "resize", label: "Resize" },
  { id: "upscale", label: "Upscale" },
  { id: "removebg", label: "Cut out" },
];

interface PanelProps {
  tool: ImageTool;
  onReplace: () => void;
}

export function Panel({ tool, onReplace }: PanelProps) {
  const { state, dispatch, output, target, showFit, needsAlpha, keySwatch } = tool;
  const source = state.source;
  if (!source) return null;

  return (
    <aside className="panel">
      <div className="panel-file">
        <div className="pf-name" title={source.name}>
          {source.name}
        </div>
        <div className="pf-actions">
          <button type="button" className="mini-btn" onClick={onReplace}>
            Replace
          </button>
          <button
            type="button"
            className="mini-btn mini-btn--danger"
            onClick={tool.clearSource}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="tool-nav" role="tablist" aria-label="Tool">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={state.tool === entry.id}
            className={state.tool === entry.id ? "tool-btn is-active" : "tool-btn"}
            onClick={() => dispatch({ type: "tool", tool: entry.id })}
          >
            <ToolIcon tool={entry.id} size={15} />
            {entry.label}
          </button>
        ))}
      </div>

      {state.tool === "resize" && (
        <ResizePanel
          source={source}
          mode={state.mode}
          width={state.width}
          height={state.height}
          lockAspect={state.lockAspect}
          percent={state.percent}
          presetIndex={state.presetIndex}
          fit={state.fit}
          showFit={showFit}
          target={target}
          onMode={(mode) => dispatch({ type: "mode", mode })}
          onWidth={(value) => dispatch({ type: "width", value })}
          onHeight={(value) => dispatch({ type: "height", value })}
          onToggleLock={() => dispatch({ type: "toggleLock" })}
          onPercent={(value) => dispatch({ type: "percent", value })}
          onPreset={(index) => dispatch({ type: "preset", index })}
          onFit={(fit) => dispatch({ type: "fit", fit })}
        />
      )}

      {state.tool === "upscale" && (
        <UpscalePanel
          up={state.up}
          target={target}
          onChange={(patch) => dispatch({ type: "up", patch })}
        />
      )}

      {state.tool === "removebg" && (
        <CutoutPanel
          bg={state.bg}
          keySwatch={keySwatch}
          onChange={(patch) => dispatch({ type: "bg", patch })}
        />
      )}

      <div className="field-block">
        <span className="block-label">Output</span>
        <div className="out-row">
          <label className="field field--grow">
            <span>Format</span>
            <select
              value={state.format}
              onChange={(e) =>
                dispatch({ type: "format", format: e.target.value as OutputFormat })
              }
            >
              {/* JPG has no alpha channel, so a transparent cut-out cannot use it. */}
              <option value="image/jpeg" disabled={needsAlpha}>
                JPG
              </option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
          </label>
        </div>

        {state.format !== "image/png" && (
          <label className="field">
            <span>
              Quality <b>{Math.round(state.quality * 100)}</b>
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(state.quality * 100)}
              onChange={(e) => dispatch({ type: "quality", value: Number(e.target.value) / 100 })}
            />
          </label>
        )}
      </div>

      <Readout source={source} target={target} blob={output?.blob ?? null} />

      <div className="panel-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!output}
          onClick={tool.download}
        >
          <DownloadIcon />
          Download
        </button>
        <button
          type="button"
          className="secondary-btn"
          title="Copy image to clipboard"
          onClick={tool.copy}
        >
          Copy
        </button>
        <button type="button" className="text-btn" onClick={() => dispatch({ type: "reset" })}>
          Reset
        </button>
      </div>
    </aside>
  );
}
