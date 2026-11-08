"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Building2, CalendarDays, Camera, Mail, Phone, Save } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { ChangePasswordCard } from "@/components/shared/change-password-form";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage, pictureUrl } from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";
import type { User } from "@/types";

const schema = z.object({
  phone: z
    .string()
    .max(30, "Phone number is too long")
    .refine((v) => v === "" || /^[+\d][\d\s().-]{4,}$/.test(v), "Enter a valid phone number"),
});
type FormValues = z.infer<typeof schema>;

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>
        <Icon className="size-3.5 text-ink-muted" /> {label}
      </Label>
      <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-navy">
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: user.phone ?? "" },
  });

  async function onSave(v: FormValues) {
    try {
      const { data } = await api.patch<User>("/api/profile", { phone: v.phone.trim() || null });
      setUser(data);
      reset({ phone: data.phone ?? "" });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not update profile"));
    }
  }

  async function onPicture(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (jpg, png, gif or webp)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<User>("/api/profile/picture", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not upload picture"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="My Profile" description="Your personal and employment details." />

      <Card className="overflow-hidden">
        <div className="relative h-28 bg-gradient-to-r from-navy via-navy-sidebar to-navy">
          <div className="bg-grid-faint absolute inset-0 opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gold/60" />
        </div>
        <CardContent className="-mt-12 flex flex-col gap-5 pb-6 sm:flex-row sm:items-end">
          <div className="relative w-fit">
            <Avatar className="size-24 border-4 border-white shadow-md">
              <AvatarImage src={pictureUrl(user.profile_picture_url ?? user.profile_picture)} alt={user.full_name} />
              <AvatarFallback className="text-2xl">{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => onPicture(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-white bg-gold text-navy shadow-md transition-colors hover:bg-[#d4ae33] disabled:opacity-60"
              aria-label="Change profile picture"
            >
              {uploading ? <span className="size-3.5 animate-spin rounded-full border-2 border-navy/30 border-t-navy" /> : <Camera className="size-4" />}
            </button>
          </div>
          <div className="min-w-0 flex-1 sm:pb-1">
            <h2 className="font-display text-2xl font-semibold text-navy">{user.full_name}</h2>
            <p className="text-sm text-ink-muted">
              {user.designation ?? "Employee"}
              {user.department ? ` · ${user.department}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employment details</CardTitle>
            <CardDescription>These details are managed by your administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field icon={Mail} label="Email" value={user.email} />
              <Field icon={Building2} label="Department" value={user.department ?? "—"} />
              <Field icon={Briefcase} label="Designation" value={user.designation ?? "—"} />
              <Field icon={CalendarDays} label="Joining date" value={formatDate(user.joining_date)} />
              <Field icon={CalendarDays} label="Account created" value={formatDate(user.created_at)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
            <CardDescription>You can update your phone number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  <Phone className="size-3.5 text-ink-muted" /> Phone
                </Label>
                <Input id="phone" type="tel" placeholder="+1 555 0100" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <Button type="submit" variant="gold" className="w-full" loading={isSubmitting} disabled={!isDirty}>
                <Save /> Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordCard />
    </div>
  );
}
