"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy route — password reset now uses email OTP on /verify-otp. */
export default function ResetPasswordRedirectPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const email = search.get("email");
    const q = new URLSearchParams({ purpose: "password_reset" });
    if (email) q.set("email", email);
    router.replace(email ? `/verify-otp?${q.toString()}` : "/forgot-password");
  }, [router, search]);

  return null;
}
