import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const sql = getSql();
    const [counts] = await sql`select
      (select count(*)::int from public.clients) as clients,
      (select count(*)::int from public.calls) as calls,
      (select count(*)::int from public.client_sessions) as sessions`;
    return Response.json({ ok: true, provider: "supabase", ...counts }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ ok: false, error: "Database connection failed." }, { status: 503 });
  }
}
