import type { InputHTMLAttributes } from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "onChange">;

// sliding on/off toggle switch
export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  ...rest
}: Props) {
  const inputId = id || `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label
      className={`toggle-row${disabled ? " is-disabled" : ""}`}
      htmlFor={inputId}
    >
      <span className="toggle-copy">
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </span>
      <span className="toggle-control">
        <input
          {...rest}
          id={inputId}
          type="checkbox"
          className="toggle-input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track" aria-hidden>
          <span className="toggle-thumb" />
        </span>
      </span>
    </label>
  );
}
