"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage } from "@/lib/api";
import { setToken } from "@/lib/auth";
import type { MessageResponse, TokenResponse } from "@/types";

export default function VerifyOtpPage() {
  const router = useRouter();
  const search = useSearchParams();
  const email = (search.get("email") || "").trim().toLowerCase();
  const purpose = search.get("purpose") === "password_reset" ? "password_reset" : "register";
  const [show, setShow] = useState(false);
  const [resending, setResending] = useState(false);

  const schema = useMemo(() => {
    const base = z.object({
      otp: z.string().trim().min(4, "Enter the OTP from your email").max(8),
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirm: z.string().min(1, "Please confirm your password"),
    });
    return base.refine((v) => v.password === v.confirm, {
      path: ["confirm"],
      message: "Passwords do not match",
    });
  }, []);

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { otp: "", password: "", confirm: "" },
  });

  if (!email) {
    return (
      <div className="animate-fade-up text-center">
        <h1 className="font-display text-[28px] font-semibold text-navy">Missing email</h1>
        <p className="mt-2 text-sm text-ink-muted">Start again from registration or forgot password.</p>
        <Button asChild variant="gold" className="mt-6">
          <Link href="/register">Go to register</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      if (purpose === "register") {
        const { data } = await api.post<TokenResponse>("/api/auth/verify-registration", {
          email,
          otp: values.otp.trim(),
          password: values.password,
        });
        setToken(data.access_token, data.expires_in);
        toast.success("Email verified — welcome aboard");
        router.replace("/dashboard");
        return;
      }

      await api.post<MessageResponse>("/api/auth/reset-password", {
        email,
        otp: values.otp.trim(),
        new_password: values.password,
      });
      toast.success("Password updated");
      router.replace("/login");
    } catch (e) {
      toast.error(getErrorMessage(e, "Verification failed"));
    }
  }

  async function resend() {
    setResending(true);
    try {
      const { data } = await api.post<MessageResponse>("/api/auth/resend-otp", { email, purpose });
      toast.success(data.message);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not resend OTP"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href={purpose === "register" ? "/register" : "/forgot-password"}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-navy"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight text-navy">
          {purpose === "register" ? "Verify your email" : "Enter reset OTP"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          We sent a 6-digit code to <span className="break-all font-semibold text-navy">{email}</span>. Enter it
          below and set your password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="otp">OTP code</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className="h-11 pl-9 tracking-[0.35em] font-semibold"
              aria-invalid={!!errors.otp}
              {...register("otp")}
            />
          </div>
          {errors.otp && <p className="text-xs text-destructive">{errors.otp.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{purpose === "register" ? "Create password" : "New password"}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 px-9"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-navy"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 pl-9"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
          </div>
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" loading={isSubmitting}>
          {purpose === "register" ? "Verify & create account" : "Reset password"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-muted">
        Didn&apos;t get the code?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="font-semibold text-navy hover:text-gold-dark disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend OTP"}
        </button>
      </div>
    </div>
  );
}
