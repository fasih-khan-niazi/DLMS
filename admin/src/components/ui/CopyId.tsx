import { useState } from "react";
import { useToast } from "./Toast";

type Props = {
  value: string;
  label?: string;
};

export function CopyId({ value, label }: Props) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const short =
    value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast(label ? `${label} copied` : "Copied", "success", 1800);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      showToast("Could not copy", "error");
    }
  }

  return (
    <button
      type="button"
      className="copy-id"
      title={value}
      onClick={() => void copy()}
    >
      <span className="mono">{copied ? "Copied" : short}</span>
    </button>
  );
}
