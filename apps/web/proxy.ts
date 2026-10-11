import { authConfig } from "./auth-config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isProtected =
    nextUrl.pathname.startsWith("/dashboard") || nextUrl.pathname.startsWith("/admin");
  const isLoginPage = nextUrl.pathname.startsWith("/login");

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoginPage && isLoggedIn) {
    // Only ADMIN sessions can exist (see auth.ts `authorize`), so the admin
    // console is the only sensible landing page.
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
