import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedRequestOrigin } from "@/lib/auth-http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const productIdSchema = z.uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Untrusted request origin." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const parsedId = productIdSchema.safeParse((await params).productId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to claim this add-on." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { data, error } = await supabase.rpc("claim_free_addon", {
    target_product_id: parsedId.data
  });
  if (error) {
    const unavailable = error.message.includes("not available");
    return NextResponse.json(
      { error: unavailable ? "This free add-on is not available." : "Could not add this add-on to your library." },
      { status: unavailable ? 404 : 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, entitlementId: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
