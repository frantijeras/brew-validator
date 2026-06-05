import { auth } from "@/lib/auth";

export default auth((req) => {
  if (!req.auth) {
    // For API routes, return 401 JSON
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    // For page routes, redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    // Protect everything EXCEPT:
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|icon|api/bridge/heartbeat|api/bridge/status|api/settings/available-models).*)",
  ],
};
