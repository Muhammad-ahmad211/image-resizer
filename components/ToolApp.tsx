"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Dropzone } from "./Dropzone";
import { Panel } from "./Panel";
import { Stage } from "./Stage";
import { Toast, useToast } from "./Toast";
import { useImageTool } from "@/hooks/useImageTool";
import type { ToolId } from "@/lib/types";

export function ToolApp() {
  const { toast, notify } = useToast();
  const tool = useImageTool(notify);
  const { state, openFiles, loadSample, pickKeyAt } = tool;

  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Tool chosen from a landing-screen card, applied once an image loads. */
  const pendingToolRef = useRef<ToolId | null>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = useCallback((next?: ToolId) => {
    pendingToolRef.current = next ?? null;
    fileInputRef.current?.click();
  }, []);

  const receive = useCallback(
    (files: FileList | File[] | null) => {
      openFiles(files, pendingToolRef.current);
      pendingToolRef.current = null;
    },
    [openFiles],
  );

  /* The ad rails collapse once there is an image to work on. */
  useEffect(() => {
    document.body.classList.toggle("has-image", Boolean(state.source));
    return () => document.body.classList.remove("has-image");
  }, [state.source]);

  /* ---- Drag & drop anywhere on the page ---- */
  useEffect(() => {
    let depth = 0;

    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files"));

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      receive(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [receive]);

  /* ---- Paste an image from the clipboard ---- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type?.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            receive([file]);
          }
          return;
        }
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [receive]);

  return (
    <>
      {state.source ? (
        <section className="workspace">
          <Stage
            source={state.source}
            previewUrl={tool.output?.url ?? null}
            target={tool.target}
            busy={tool.busy}
            picking={state.tool === "removebg" && state.bg.keyMode === "pick"}
            onPick={pickKeyAt}
          />
          <Panel tool={tool} onReplace={openPicker} />
        </section>
      ) : (
        <Dropzone onBrowse={openPicker} onSample={loadSample} />
      )}

      {dragging && (
        <div className="drag-overlay">
          <div>Drop to load</div>
        </div>
      )}

      <Toast toast={toast} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          receive(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
