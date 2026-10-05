"use client";

import { Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRelative, humanize } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import type { RecordNote } from "@/types";

/** Append-only clinical notes. Never offers edit or delete. */
export function NotesTimeline({
  notes,
  newestFirst = false,
  emptyLabel = "No notes yet.",
}: {
  notes: RecordNote[];
  newestFirst?: boolean;
  emptyLabel?: string;
}) {
  if (!notes.length) return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  const sorted = [...notes].sort((a, b) => (newestFirst ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  return (
    <ol className="before:bg-border relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px">
      {sorted.map((n) => (
        <li key={n.id} className="relative flex gap-3">
          <UserAvatar name={n.authorName} className="ring-card z-[1] size-7 ring-2" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{n.authorName}</span>
              <span className="text-muted-foreground text-xs">{humanize(n.authorRole)}</span>
              <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="text-muted-foreground text-xs">
                {formatDateTime(n.createdAt)} · {formatRelative(n.createdAt)}
              </time>
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-line">{n.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Add-a-note composer. Text is reduced to plain text before it is sent. */
export function AddNoteForm({
  id,
  label = "Add note",
  description,
  placeholder = "Write a note…",
  onSubmit,
}: {
  id: string;
  label?: string;
  description?: string;
  placeholder?: string;
  onSubmit: (text: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = toPlainText(text).trim();
    if (!clean) {
      setError("Write something first");
      return;
    }
    if (clean.length > 4000) {
      setError("Keep notes under 4,000 characters");
      return;
    }
    setPending(true);
    try {
      await onSubmit(clean);
      setText("");
      setError(undefined);
    } catch {
      // toast from the mutation cache
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Textarea
          id={id}
          rows={3}
          value={text}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(undefined);
          }}
        />
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldError errors={error ? [{ message: error }] : undefined} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
          {label}
        </Button>
      </div>
    </form>
  );
}
