"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage } from "@/lib/api";

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "New password must differ from the current one",
  });
type FormValues = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  async function onSubmit(v: FormValues) {
    try {
      await api.patch("/api/auth/change-password", {
        current_password: v.current_password,
        new_password: v.new_password,
      });
      toast.success("Password changed successfully");
      reset();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not change password"));
    }
  }

  return (
    <Card id="password" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-gold-dark" /> Change password
        </CardTitle>
        <CardDescription>Use a strong password you don&apos;t use anywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="current_password">Current password</Label>
            <Input id="current_password" type={show ? "text" : "password"} autoComplete="current-password" aria-invalid={!!errors.current_password} {...register("current_password")} />
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password</Label>
            <Input id="new_password" type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={!!errors.new_password} {...register("new_password")} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input id="confirm_password" type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-navy"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {show ? "Hide" : "Show"} passwords
            </button>
            <Button type="submit" variant="gold" loading={isSubmitting}>
              <KeyRound /> Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
