import { syncSupabaseToNeon } from "@/lib/neon/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncSupabaseToNeon();
    return Response.json(result, { status: result.targetHasAllSourceRows ? 200 : 409 });
  } catch (error) {
    console.error("Supabase to Neon sync failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Database sync failed." },
      { status: 500 }
    );
  }
}
