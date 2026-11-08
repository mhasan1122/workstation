"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Mail, UserRound } from "lucide-react";
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
  full_name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const { data } = await api.post<MessageResponse>("/api/auth/register", {
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
      });
      toast.success(data.message);
      const q = new URLSearchParams({
        email: values.email.trim().toLowerCase(),
        purpose: "register",
      });
      router.push(`/verify-otp?${q.toString()}`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not start registration"));
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight text-navy">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your name and work email. We&apos;ll send a one-time code to verify it.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="full_name"
              autoComplete="name"
              placeholder="Your full name"
              className="h-11 pl-9"
              aria-invalid={!!errors.full_name}
              {...register("full_name")}
            />
          </div>
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
        </div>

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
          Send verification OTP
          {!isSubmitting && <ArrowRight />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy hover:text-gold-dark">
          Sign in
        </Link>
      </p>
    </div>
  );
}
