import Cookies from "js-cookie";

export const TOKEN_COOKIE = "ep_token";

export function getToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return Cookies.get(TOKEN_COOKIE);
}

export function setToken(token: string, expiresInSeconds = 86400): void {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: expiresInSeconds / 86400,
    sameSite: "lax",
    path: "/",
  });
}

export function clearToken(): void {
  Cookies.remove(TOKEN_COOKIE, { path: "/" });
}
