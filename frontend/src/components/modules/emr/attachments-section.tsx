"use client";

import { Download, FileImage, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/constants/config";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useAddAttachment } from "@/services/emr";
import type { MedicalRecord } from "@/types";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

export function AttachmentsSection({ record, canUpload }: { record: MedicalRecord; canUpload: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const add = useAddAttachment(record.id);
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const busy = reading || add.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setError(`${file.name}: only PDF, PNG, JPEG and WebP files are allowed.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)}. Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`);
      return;
    }
    try {
      setReading(true);
      const dataUrl = await readAsDataUrl(file);
      setReading(false);
      await add.mutateAsync({ name: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
      toast.success(`${file.name} attached`);
    } catch (err) {
      if (err instanceof DOMException) setError("Couldn't read the file. Try again.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const attachments = [...record.attachments].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return (
    <SectionCard
      title="Attachments"
      description="Reports, scans and referral letters. PDF, PNG, JPEG or WebP up to 20 MB."
      action={
        canUpload && (
          <>
            <input
              ref={inputRef}
              id="attachment-input"
              type="file"
              className="sr-only"
              accept={ALLOWED_UPLOAD_TYPES.join(",")}
              onChange={(e) => onFile(e.target.files?.[0])}
              disabled={busy}
              aria-describedby={error ? "attachment-error" : undefined}
            />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              {busy ? "Uploading…" : "Upload file"}
            </Button>
          </>
        )
      }
      contentClassName="p-0"
    >
      {error && (
        <p id="attachment-error" role="alert" className="text-destructive border-b px-4 py-2 text-sm">
          {error}
        </p>
      )}
      {attachments.length === 0 ? (
        <EmptyState compact icon={Paperclip} title="No attachments" />
      ) : (
        <ul className="divide-y">
          {attachments.map((a) => {
            const Icon = a.mimeType.startsWith("image/") ? FileImage : FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatBytes(a.sizeBytes)} · {formatDateTime(a.uploadedAt)}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={a.url} download={a.name} aria-label={`Download ${a.name}`}>
                    <Download />
                  </a>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
