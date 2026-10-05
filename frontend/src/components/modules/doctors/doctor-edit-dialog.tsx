"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, Loader2, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { doctorName } from "@/lib/format";
import { useUpdateDoctor } from "@/services/doctors";
import type { Doctor } from "@/types";

const MAX_SIGNATURE_BYTES = 1024 * 1024;
const SIGNATURE_TYPES = ["image/png", "image/jpeg"];

const schema = z.object({
  bio: z.string().trim().max(1000, "Keep the bio under 1000 characters"),
  consultationFee: z.coerce.number({ invalid_type_error: "Enter a fee" }).min(0, "Fee can't be negative").max(100000, "Fee looks too high"),
  languages: z
    .string()
    .trim()
    .min(1, "Add at least one language")
    .refine((v) => v.split(",").every((l) => l.trim().length > 0), "Separate languages with commas"),
  isAcceptingPatients: z.boolean(),
  signatureDataUrl: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function DoctorEditDialog({ doctor }: { doctor: Doctor }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {open && <EditForm doctor={doctor} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ doctor, onDone }: { doctor: Doctor; onDone: () => void }) {
  const update = useUpdateDoctor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bio: doctor.bio ?? "",
      consultationFee: doctor.consultationFee,
      languages: doctor.languages.join(", "),
      isAcceptingPatients: doctor.isAcceptingPatients,
      signatureDataUrl: doctor.signatureDataUrl ?? "",
    },
  });
  const e = form.formState.errors;
  const signature = form.watch("signatureDataUrl");

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!SIGNATURE_TYPES.includes(file.type)) {
      setFileError("Upload a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setFileError("The image must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => form.setValue("signatureDataUrl", String(reader.result), { shouldDirty: true });
    reader.onerror = () => setFileError("Couldn't read that file. Try another.");
    reader.readAsDataURL(file);
  };

  const submit = form.handleSubmit(async (v) => {
    try {
      await update.mutateAsync({
        id: doctor.id,
        bio: v.bio,
        consultationFee: v.consultationFee,
        languages: v.languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        isAcceptingPatients: v.isAcceptingPatients,
        // Empty string clears the stored signature.
        signatureDataUrl: v.signatureDataUrl || "",
      });
      toast.success("Profile updated");
      onDone();
    } catch {
      // Toasted globally.
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>{doctorName(doctor)} · shown to patients when booking.</DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4 gap-4">
        <Field data-invalid={!!e.bio || undefined}>
          <FieldLabel htmlFor="doc-bio">Bio</FieldLabel>
          <Textarea id="doc-bio" rows={4} maxLength={1000} aria-invalid={!!e.bio || undefined} {...form.register("bio")} />
          <FieldError errors={[e.bio]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!e.consultationFee || undefined}>
            <FieldLabel htmlFor="doc-fee">Consultation fee (₹)</FieldLabel>
            <Input
              id="doc-fee"
              type="number"
              inputMode="numeric"
              min={0}
              step={50}
              className="tabular-nums"
              aria-invalid={!!e.consultationFee || undefined}
              {...form.register("consultationFee")}
            />
            <FieldError errors={[e.consultationFee]} />
          </Field>
          <Field data-invalid={!!e.languages || undefined}>
            <FieldLabel htmlFor="doc-langs">Languages</FieldLabel>
            <Input id="doc-langs" placeholder="English, Hindi" aria-invalid={!!e.languages || undefined} {...form.register("languages")} />
            <FieldDescription>Comma-separated.</FieldDescription>
            <FieldError errors={[e.languages]} />
          </Field>
        </div>

        <Controller
          control={form.control}
          name="isAcceptingPatients"
          render={({ field }) => (
            <FieldLabel htmlFor="doc-accepting">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Accepting new patients</FieldTitle>
                  <FieldDescription>When off, the doctor is hidden from online booking (emergencies still allowed).</FieldDescription>
                </FieldContent>
                <Switch id="doc-accepting" checked={field.value} onCheckedChange={field.onChange} />
              </Field>
            </FieldLabel>
          )}
        />

        <Field data-invalid={!!fileError || undefined}>
          <FieldLabel htmlFor="doc-signature">Signature</FieldLabel>
          <FieldDescription>PNG or JPEG, up to 1 MB. Printed on prescriptions.</FieldDescription>
          {signature ? (
            <div className="bg-background flex items-center gap-3 rounded-lg border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
              <img src={signature} alt="Signature preview" className="h-14 max-w-48 object-contain" />
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove signature"
                  onClick={() => form.setValue("signatureDataUrl", "", { shouldDirty: true })}
                >
                  <X />
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-fit" onClick={() => fileRef.current?.click()}>
              <ImageUp /> Upload signature
            </Button>
          )}
          <input
            ref={fileRef}
            id="doc-signature"
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            tabIndex={-1}
            onChange={(ev) => {
              onFile(ev.target.files?.[0]);
              ev.target.value = "";
            }}
          />
          <FieldError errors={fileError ? [{ message: fileError }] : []} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
