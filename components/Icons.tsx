/* The inline SVGs from the original markup, as components so each one is
   written once. All are decorative unless a parent labels them. */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  "aria-hidden": true as const,
});

export function BrandMark({ size = 26 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M9 21V11h4M23 11v10h-4M13 11l10 10"
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" />
      </g>
    </svg>
  );
}

export function MoonIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  );
}

export function ImageIcon({ size = 34 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M4 15l4-4 4 4 4-6 4 5M4 5h16v14H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResizeIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M9 21V9h3M21 9v12h-3M12 9l9 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpscaleIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M4 20L20 4M20 10V4h-6M10 20H4v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CutoutIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 5h3M16 5h3M5 19h3M16 19h3M5 5v3M19 5v3M5 19v-3M19 19v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockedIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UnlockedIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M7 10V8a5 5 0 0 1 9.5-2M5 10h14v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon for each tool id, at the size the caller needs. */
export function ToolIcon({ tool, size }: { tool: "resize" | "upscale" | "removebg"; size?: number }) {
  if (tool === "upscale") return <UpscaleIcon size={size} />;
  if (tool === "removebg") return <CutoutIcon size={size} />;
  return <ResizeIcon size={size} />;
}
