"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Optional quick-add suggestions shown under the input. */
  suggestions?: string[];
  maxLength?: number;
  className?: string;
  "aria-describedby"?: string;
}

/** Free-text chips: Enter or comma adds, Backspace on an empty input removes the last chip. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  disabled,
  invalid,
  suggestions,
  maxLength = 80,
  className,
  ...rest
}: TagInputProps) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const tag = raw.replace(/[<>]/g, "").trim().slice(0, maxLength);
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setText("");
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));
  const remaining = suggestions?.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())) ?? [];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border bg-transparent px-1.5 py-1 text-sm transition-colors focus-within:ring-3",
          invalid && "border-destructive ring-destructive/20 ring-3",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-xs font-medium"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(tag)}
                className="hover:bg-foreground/10 focus-visible:outline-ring rounded p-0.5 focus-visible:outline-2"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={rest["aria-describedby"]}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(text)}
          placeholder={value.length ? "" : placeholder}
          className="placeholder:text-muted-foreground h-6 min-w-32 flex-1 bg-transparent px-1 outline-none"
        />
      </div>
      {!disabled && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Suggestions">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-md border border-dashed px-1.5 py-0.5 text-xs hover:border-solid focus-visible:outline-2"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
