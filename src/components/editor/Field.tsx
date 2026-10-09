"use client";

import { useId, forwardRef } from "react";

export interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  id?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(
  function Field(
    {
      label,
      value,
      onChange,
      multiline = false,
      placeholder,
      maxLength = 20000,
      id,
      className,
      autoFocus,
      onKeyDown,
    },
    ref,
  ) {
    const generatedId = useId();
    const labelId = id ? `${id}-label` : generatedId;

    return (
      <label className={`field ${className || ""}`.trim()}>
        <span id={labelId}>{label}</span>
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={id}
            aria-labelledby={labelId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={4}
            autoFocus={autoFocus}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={id}
            aria-labelledby={labelId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus={autoFocus}
          />
        )}
      </label>
    );
  },
);
