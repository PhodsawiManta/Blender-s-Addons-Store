import { NextResponse } from "next/server";
import { getCanonicalSiteUrl } from "@/lib/env";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache"
} as const;

export function createNoStoreHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => headers.set(name, value));
  return headers;
}

export function applyNoStore(response: NextResponse) {
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export function jsonNoStore(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders(headers)
  });
}

export function redirectNoStore(url: URL | string, headers?: HeadersInit) {
  return applyNoStore(NextResponse.redirect(url, { headers }));
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

export function hasTrustedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const suppliedOrigin = new URL(origin).origin;
    const requestOrigin = new URL(request.url).origin;
    const canonicalOrigin = getCanonicalSiteUrl();
    return suppliedOrigin === requestOrigin || suppliedOrigin === canonicalOrigin;
  } catch {
    return false;
  }
}
