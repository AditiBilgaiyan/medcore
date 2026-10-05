"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/shared/section-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { applyServerErrors, phoneSchema, requiredString } from "@/lib/validation";
import { useUpdateProfile } from "@/services/auth";
import { PhoneVerification } from "./phone-verification";

const schema = z.object({
  firstName: requiredString("First name").max(50, "Keep it under 50 characters"),
  lastName: requiredString("Last name").max(50, "Keep it under 50 characters"),
  phone: phoneSchema,
});
type Values = z.infer<typeof schema>;

export function ProfileCard() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", phone: user?.phone ?? "" },
  });
  const { register, handleSubmit, reset, setError, formState } = form;
  const { errors, isDirty } = formState;

  // Keep the form in sync after a successful save (or a phone verification) updates the user.
  // Depend on the primitive fields so a token refresh (new object, same values) doesn't wipe edits.
  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const phone = user?.phone ?? "";
  useEffect(() => {
    reset({ firstName, lastName, phone });
  }, [firstName, lastName, phone, reset]);

  if (!user) return null;

  const onSubmit = handleSubmit(async (values) => {
    const phoneChanged = values.phone.trim() !== user.phone;
    try {
      await update.mutateAsync({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), phone: values.phone.trim() });
      toast.success("Profile updated", {
        description: phoneChanged ? "Your new phone number needs to be verified." : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<Values>(err.details, setError);
    }
  });

  return (
    <SectionCard title="Profile" description="Your name and contact number as shown to colleagues and on documents.">
      <div className="mb-5 flex items-center gap-3">
        <UserAvatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} className="size-12 text-base" />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {ROLE_LABELS[user.role]}
            {user.hospitalName && ` · ${user.hospitalName}`}
          </p>
          {user.lastLoginAt && (
            <p className="text-muted-foreground text-xs">Last sign-in {formatDate(user.lastLoginAt, "dd MMM yyyy, HH:mm")}</p>
          )}
        </div>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.firstName}>
              <FieldLabel htmlFor="profile-first-name">First name</FieldLabel>
              <Input id="profile-first-name" autoComplete="given-name" aria-invalid={!!errors.firstName} {...register("firstName")} />
              <FieldError errors={[errors.firstName]} />
            </Field>
            <Field data-invalid={!!errors.lastName}>
              <FieldLabel htmlFor="profile-last-name">Last name</FieldLabel>
              <Input id="profile-last-name" autoComplete="family-name" aria-invalid={!!errors.lastName} {...register("lastName")} />
              <FieldError errors={[errors.lastName]} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input id="profile-email" value={user.email} readOnly disabled aria-describedby="profile-email-help" />
            <FieldDescription id="profile-email-help">Your sign-in email can only be changed by an administrator.</FieldDescription>
          </Field>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby="profile-phone-help"
              {...register("phone")}
            />
            <FieldDescription id="profile-phone-help">Changing your number resets its verification status.</FieldDescription>
            <FieldError errors={[errors.phone]} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => reset()} disabled={!isDirty || update.isPending}>
              Discard
            </Button>
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Save changes
            </Button>
          </div>
        </FieldGroup>
      </form>
      <div className="mt-5 border-t pt-4">
        <PhoneVerification />
      </div>
    </SectionCard>
  );
}
