import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  if (!request.cookies.has(AUTH_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
