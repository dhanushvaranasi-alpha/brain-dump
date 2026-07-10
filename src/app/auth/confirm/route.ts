import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow local paths as the post-auth destination. Reject absolute URLs
  // and protocol-relative (`//`, `/\`) values to prevent an open redirect.
  const rawNext = searchParams.get("next") ?? "/tasks";
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : "/tasks";

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session (OAuth/PKCE flow)
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
