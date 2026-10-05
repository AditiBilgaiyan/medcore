"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask for a free-text reason (e.g. cancellations). */
  reason?: { label: string; placeholder?: string; required?: boolean };
  onConfirm: (reason: string) => Promise<unknown> | void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  reason,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(v);
    onOpenChange?.(v);
    if (!v) setText("");
  };
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = !!reason?.required && !text.trim();

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm(text.trim());
      setOpen(false);
    } catch {
      // Error toast comes from the mutation cache; keep the dialog open.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {reason && (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">
              {reason.label}
              {reason.required && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="confirm-reason"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder}
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={destructive ? "bg-destructive hover:bg-destructive/90 text-white" : undefined}
            onClick={confirm}
            disabled={pending || blocked}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
