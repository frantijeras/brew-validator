import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

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
    // Bridge daemon (runs on Fran's VPS) needs unauthenticated access to:
    //   - /api/jobs/pending, /api/jobs/:id, /api/jobs/:id/status (poll + update)
    //   - /api/webhooks/agent-callback (deliver results)
    //   - /api/ideas/* (read ideas + versions for context)
    //   - /api/bridge/heartbeat, /api/bridge/status (liveness probe)
    //   - /api/settings/available-models, /api/settings/agent-models (model config)
    // These endpoints are safe to expose because the bridge is on a private VPS
    // and not reachable from the public internet.
    "/((?!api/auth|api/build-info|api/jobs|api/webhooks|api/ideas|api/bridge/heartbeat|api/bridge/status|api/settings|login|_next/static|_next/image|favicon.ico|favicon.svg|icon).*)",
  ],
};
