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
let warnedMissingSecret = false;

export function verifyBridgeSecret(req: Request): boolean {
  const secret = process.env.BRIDGE_SECRET;
  if (!secret) {
    // Fail-open until the secret is provisioned on BOTH the VPS bridge and
    // Vercel — this keeps the running bridge working during rollout. Warn once
    // per instance so the unauthenticated window is visible in the logs.
    // TODO(seguridad): una vez creado /root/.openclaw/credentials/
    // brew-validator-bridge-secret.txt en el VPS y configurado BRIDGE_SECRET en
    // Vercel, cambiar este `return true` por `return false` (fail-closed).
    if (!warnedMissingSecret) {
      console.warn(
        "[SECURITY] BRIDGE_SECRET no configurado: los endpoints del bridge " +
          "requieren autenticación (fail-closed). Verifica que el secreto " +
          "está en el VPS y en Vercel."
      );
      warnedMissingSecret = true;
    }
    return false;
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}
