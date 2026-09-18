"use client";

/** The segmented control used for resize mode, fit, scale factor and key mode. */
export interface SegOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegProps<T extends string | number> {
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `seg--sm` in the original stylesheet. */
  small?: boolean;
  label: string;
  /** Renders the buttons as tabs, matching the original ARIA roles. */
  tabs?: boolean;
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  small,
  label,
  tabs,
}: SegProps<T>) {
  return (
    <div
      className={small ? "seg seg--sm" : "seg"}
      role={tabs ? "tablist" : "group"}
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? active : undefined}
            aria-pressed={tabs ? undefined : active}
            className={active ? "seg-btn is-active" : "seg-btn"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
