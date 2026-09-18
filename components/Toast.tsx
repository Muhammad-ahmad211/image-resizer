"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VISIBLE_MS = 3200;
const FADE_MS = 250;

export interface ToastState {
  message: string;
  /** Bumped on every notify so a repeated message restarts the timer. */
  seq: number;
}

/** Transient status line; `notify` is stable, so effects can depend on it. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seqRef = useRef(0);

  const notify = useCallback((message: string) => {
    seqRef.current += 1;
    setToast({ message, seq: seqRef.current });
  }, []);

  return { toast, notify };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  /** Sequence currently wearing the `show` class, and the one already faded. */
  const [shownSeq, setShownSeq] = useState(0);
  const [doneSeq, setDoneSeq] = useState(0);

  useEffect(() => {
    if (!toast) return;

    // Next frame, so the CSS transition has a state to move away from.
    const raf = requestAnimationFrame(() => setShownSeq(toast.seq));
    const fade = setTimeout(() => setShownSeq(0), VISIBLE_MS);
    const drop = setTimeout(() => setDoneSeq(toast.seq), VISIBLE_MS + FADE_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      clearTimeout(drop);
    };
  }, [toast]);

  if (!toast || toast.seq === doneSeq) return null;

  return (
    <div
      className={shownSeq === toast.seq ? "toast show" : "toast"}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
