import axios, { AxiosError } from "axios";
import { clearToken, getToken } from "@/lib/auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-otp"];

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      const isLoginCall = error.config?.url?.includes("/api/auth/login");
      if (!isLoginCall && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
        clearToken();
        const next = encodeURIComponent(path + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);

/** Resolve a backend-relative asset path (e.g. /uploads/...) to a full URL. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Resolve a stored profile picture value (relative upload path or external URL). */
export function pictureUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return assetUrl(path);
  return assetUrl(`/uploads/${path}`);
}

/** Extract a human-readable message from any thrown error (FastAPI shapes included). */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Cannot reach the server. Check your connection and try again.";
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((d: { msg?: string; loc?: (string | number)[] }) => {
          const field = d.loc?.filter((l) => l !== "body").slice(-1)[0];
          return field ? `${String(field)}: ${d.msg ?? "invalid"}` : (d.msg ?? "Invalid value");
        })
        .join("; ");
    }
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
