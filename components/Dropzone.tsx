"use client";

import { ImageIcon, ToolIcon } from "./Icons";
import type { ToolId } from "@/lib/types";

const TOOL_CARDS: { tool: ToolId; title: string; blurb: string }[] = [
  {
    tool: "resize",
    title: "Resize",
    blurb: "By pixels, percentage, or preset size — with aspect-ratio lock.",
  },
  {
    tool: "upscale",
    title: "Upscale",
    blurb: "Enlarge 2–4× with Lanczos resampling and sharpening.",
  },
  {
    tool: "removebg",
    title: "Cut out",
    blurb: "Remove a solid or gradient background, keep transparency.",
  },
];

interface DropzoneProps {
  /** Opens the file picker; the tool is applied once an image loads. */
  onBrowse: (tool?: ToolId) => void;
  onSample: () => void;
}

export function Dropzone({ onBrowse, onSample }: DropzoneProps) {
  return (
    <section
      className="dropzone"
      tabIndex={0}
      aria-label="Add an image"
      onClick={(e) => {
        // Let the nested buttons handle their own clicks.
        if ((e.target as HTMLElement).closest("button, a")) return;
        onBrowse();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBrowse();
        }
      }}
    >
      <div className="dz-inner">
        <div className="dz-frame">
          <ImageIcon />
        </div>
        <p className="dz-title">Drop an image to get started</p>
        <p>
          or{" "}
          <button type="button" className="link-btn" onClick={() => onBrowse()}>
            browse your files
          </button>{" "}
          · paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>
        </p>
        <button type="button" className="ghost-btn" onClick={onSample}>
          Try a sample image
        </button>

        <div className="dz-tools">
          {TOOL_CARDS.map((card) => (
            <button
              key={card.tool}
              type="button"
              className="dz-tool"
              onClick={() => onBrowse(card.tool)}
            >
              <ToolIcon tool={card.tool} size={20} />
              <b>{card.title}</b>
              <span>{card.blurb}</span>
            </button>
          ))}
        </div>

        <p className="dz-note">JPG · PNG · WebP · GIF — processed locally, never uploaded.</p>
      </div>
    </section>
  );
}
