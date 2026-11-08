"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage } from "@/lib/api";
import type { MessageResponse } from "@/types";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: FormValues) {
    try {
      const email = values.email.trim().toLowerCase();
      const { data } = await api.post<MessageResponse>("/api/auth/forgot-password", { email });
      toast.success(data.message);
      const q = new URLSearchParams({ email, purpose: "password_reset" });
      router.push(`/verify-otp?${q.toString()}`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not send OTP"));
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-navy"
      >
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>
      <div className="mb-8">
        <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight text-navy">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your work email and we&apos;ll send a one-time code to reset it.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="h-11 pl-9"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" variant="gold" size="lg" className="w-full" loading={isSubmitting}>
          Send OTP
        </Button>
      </form>
    </div>
  );
}
