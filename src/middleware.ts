import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

const { auth } = NextAuth(authConfig);

/**
 * API routes the bridge daemon (on Fran's VPS) needs to reach. They now run
 * THROUGH the auth middleware (previously they were excluded entirely, i.e.
 * open to the public internet on the Vercel deployment). Each is allowed with
 * EITHER a logged-in session (browser) OR a valid bridge secret
 * (`Authorization: Bearer <BRIDGE_SECRET>`).
 *
 * While `BRIDGE_SECRET` is unset, `verifyBridgeSecret` is fail-open, so the
 * running bridge keeps working unchanged. The hole closes the moment the secret
 * is provisioned on both the VPS and Vercel — no code change required.
 */
const BRIDGE_PATHS = [
  "/api/jobs",
  "/api/webhooks",
  "/api/bridge/heartbeat",
  "/api/bridge/status",
  "/api/ideas",
  "/api/settings/available-models",
  "/api/settings/agent-models",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    // Bridge-facing routes: allow when the shared secret check passes.
    if (
      BRIDGE_PATHS.some((p) => pathname.startsWith(p)) &&
      verifyBridgeSecret(req)
    ) {
      return;
    }
    // For API routes, return 401 JSON
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    // For page routes, redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    // Protect everything EXCEPT public/framework routes. Bridge endpoints are
    // NO LONGER excluded here — they run through the middleware and are gated
    // by session-or-bridge-secret (see BRIDGE_PATHS above).
    "/((?!api/auth|api/build-info|login|_next/static|_next/image|favicon.ico|favicon.svg|icon).*)",
  ],
};
