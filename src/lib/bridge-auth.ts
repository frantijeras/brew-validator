/**
 * Optional shared-secret authentication for bridge-facing endpoints.
 *
 * The bridge daemon (on Fran's VPS) calls a handful of unauthenticated
 * endpoints (webhooks, jobs/pending). To close that hole WITHOUT breaking the
 * running bridge, this check is **opt-in**:
 *
 *   - If `BRIDGE_SECRET` is NOT set, every request is allowed (current
 *     behaviour, backwards compatible).
 *   - If `BRIDGE_SECRET` IS set, the request must carry
 *     `Authorization: Bearer <BRIDGE_SECRET>`.
 *
 * To enable: set the same `BRIDGE_SECRET` in the Next.js env (Vercel) and in
 * the bridge daemon, and have the bridge send the header on every call.
 */
export function verifyBridgeSecret(req: Request): boolean {
  const secret = process.env.BRIDGE_SECRET;
  if (!secret) return true; // not configured → allow

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}
