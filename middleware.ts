import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow login and maintenance page
  if (pathname === "/login" || pathname === "/maintenance" || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .single()

    if (data?.value === "true") {
      // Check if user is it_admin — allow them through
      const token = request.cookies.get("sb-access-token")?.value
      if (token) {
        try {
          const { data: user } = await supabase.auth.getUser(token)
          if (user?.user) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("role")
              .eq("id", user.user.id)
              .single()
            if (profile?.role === "it_admin") return NextResponse.next()
          }
        } catch {}
      }
      return NextResponse.redirect(new URL("/maintenance", request.url))
    }
  } catch {}

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)"],
}
