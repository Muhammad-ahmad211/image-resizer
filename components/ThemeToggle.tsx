"use client";

import { MoonIcon, SunIcon } from "./Icons";

/* The stylesheet decides which glyph is visible from `data-theme` on <html>,
   so this only has to flip the attribute and remember the choice. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const next =
      current === "dark" ? "light" : current === "light" ? "dark" : prefersDark ? "light" : "dark";

    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rescale-theme", next);
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }

  return (
    <button
      type="button"
      className="icon-btn"
      title="Toggle light / dark"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <SunIcon className="i-sun" />
      <MoonIcon className="i-moon" />
    </button>
  );
}
