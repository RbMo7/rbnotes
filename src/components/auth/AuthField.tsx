import type { InputHTMLAttributes } from "react";

export function AuthField({
  id,
  label,
  prefix,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  prefix: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-space-1">
      <label
        className="font-label-sm text-label-sm text-on-surface flex items-center gap-space-1"
        htmlFor={id}
      >
        <span className={error ? "text-error" : "text-primary"}>&gt;</span> {label}
      </label>
      <div
        className={`relative flex items-center bg-surface-container border focus-within:border-primary ${
          error ? "border-error" : "border-outline-variant"
        }`}
      >
        <span className="pl-space-3 pr-space-2 text-on-surface-variant select-none font-code-editor text-code-editor">
          {prefix}
        </span>
        <input
          id={id}
          className="w-full bg-transparent pl-0 pr-space-3 py-space-2 text-on-surface placeholder-on-surface-variant/40 font-code-editor text-code-editor outline-none border-none appearance-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 shadow-none"
          {...inputProps}
        />
      </div>
      {error && (
        <p className="font-label-sm text-label-sm text-error pt-space-1">{error}</p>
      )}
    </div>
  );
}
