import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: redirects visitors without a session cookie away from
 * private areas and marks them noindex. Real authorization happens in the data
 * access layer (src/lib/auth) on every page, action and route handler.
 */

const ADMIN_PUBLIC = new Set(["/admin", "/admin/forgot-password", "/admin/reset-password", "/admin/accept-invite"]);
const PORTAL_PUBLIC = new Set(["/portal/login", "/portal/forgot-password", "/portal/reset-password"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  if (isAdmin && !ADMIN_PUBLIC.has(pathname) && !request.cookies.has("lc_admin_session")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (isPortal && !PORTAL_PUBLIC.has(pathname) && !request.cookies.has("lc_applicant_session")) {
    const login = new URL("/portal/login", request.url);
    if (pathname !== "/portal") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  if (isAdmin || isPortal) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/admin", "/portal"],
};
