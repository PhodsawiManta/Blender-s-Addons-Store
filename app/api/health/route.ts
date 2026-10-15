import { NextResponse } from "next/server";
import { getCanonicalSiteUrl, hasSupabaseAdmin } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const ready = hasSupabaseAdmin && Boolean(getCanonicalSiteUrl());

  return NextResponse.json(
    { status: ready ? "ok" : "not_ready" },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
