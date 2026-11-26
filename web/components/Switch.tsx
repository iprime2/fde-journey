"use client";

// Switch (design spec 4, v0.5): a real <input type="checkbox" role="switch">, so Space toggles it
// and screen readers say "on" or "off". Drawn by the .switch classes in app/globals.css.
import { CheckIcon } from "./icons";

export function Switch({
  id,
  checked,
  disabled,
  describedBy,
  onChange,
  inputRef,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange(on: boolean): void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <span className="switch">
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span aria-hidden="true" className="switch-track">
        <span className="switch-thumb">
          <CheckIcon size={10} />
        </span>
      </span>
    </span>
  );
}
