"use client";

import { forwardRef } from "react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | null;
  autoFocus?: boolean;
};

// Контролируемое поле даты. Собственный нативный input[type=date]
// даёт корректный календарь на Android Chrome и хороший a11y.

export const BirthDateInput = forwardRef<HTMLInputElement, Props>(
  function BirthDateInput(
    { id, label, value, onChange, hint, error, autoFocus },
    ref,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm text-ink-muted">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min="1900-01-01"
          max={today}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="input-field"
        />
        {hint && !error ? (
          <p id={`${id}-hint`} className="text-sm text-ink-faint">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
