import { headers } from "next/headers";

// Builds the redirect URL used for invite/recovery email links and manually
// generated links. Throws `missing_origin` if no safe public URL is
// configured — callers should catch it and ask the admin to set APP_URL.
export async function getActivationUrl(manualLink = false): Promise<string> {
  const origin = (await headers()).get("origin");
  if (!manualLink && process.env.NODE_ENV === "development" && origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return `${origin}/auth/activate`;
  }
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (manualLink ? "https://portal-clientes-acelera-v2.vercel.app" : null);
  if (!configured) throw new Error("missing_origin");
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || /^(localhost|127\.|\[::1\])/.test(url.hostname)) throw new Error("missing_origin");
  return `${url.origin}/auth/activate`;
}
