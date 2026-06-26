import { auth } from "./auth";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { TERMS_VERSION } from "./terms";

/**
 * Helper for API routes: checks that the request has a valid session AND that
 * the user is allowed to operate. La sesión usa JWT, así que el estado vivo
 * (suspensión, consentimiento) NO viaja en el token: lo reconsultamos aquí en
 * cada llamada para que un usuario suspendido —o que nunca aceptó los términos—
 * no pueda usar la API directamente (el gate del layout solo protege páginas).
 * Devuelve el userId o una respuesta de error (401/403).
 */
export async function requireAuth(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, isAdmin: true, termsAcceptedAt: true, termsVersion: true },
  });
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  if (user.status === "suspended") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Tu cuenta está suspendida." }, { status: 403 }),
    };
  }
  // No-admin debe haber aceptado la versión vigente de los términos.
  if (!user.isAdmin && !(user.termsAcceptedAt && user.termsVersion === TERMS_VERSION)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Debes aceptar los términos para continuar." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.user.id };
}
