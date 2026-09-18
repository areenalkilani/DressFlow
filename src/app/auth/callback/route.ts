import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/auth/email-result", request.url);
  if (code) {
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    destination.searchParams.set("status", error ? "error" : "verified");
  } else
    destination.searchParams.set(
      "status",
      request.nextUrl.searchParams.has("error") ? "error" : "pending",
    );
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
