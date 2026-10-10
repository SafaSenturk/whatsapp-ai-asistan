import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

export function proxy(request: NextRequest) {
  if (readSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Panel ve dışa aktarma oturum ister; tanıtım, kayıt ve webhook herkese açık.
  matcher: ["/app/:path*", "/api/export"],
};
