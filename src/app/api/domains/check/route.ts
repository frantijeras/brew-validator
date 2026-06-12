import { NextResponse } from "next/server";
import { z } from "zod";
import dns from "dns";
import { DOMAIN_FALLBACK_MESSAGE } from "@/lib/user-messages";

/**
 * POST /api/domains/check
 *
 * Comprueba si una lista de nombres de dominio están disponibles (no
 * registrados / sin registros en el DNS — Sistema de nombres de dominio).
 * Usa resolución DNS para inferir la disponibilidad.
 *
 * Body: { names: string[] }  (al menos un nombre)
 * Devuelve: {
 *   results: Array<{ domain: string; available: boolean | null }>,
 *   degraded?: boolean,   // true si el servicio está degradado (mayoría inconcluso)
 *   message?: string,     // copy de Fallback (Plan de contingencia) cuando degraded
 * }
 *
 * Diseño NO bloqueante: un lookup lento o fallido nunca cuelga la petición
 * ni rompe el flujo de naming. Cada lookup tiene un timeout propio y, si
 * falla o expira, ese dominio devuelve `available: null` (inconcluso).
 */

const SUFFIXES = [".es", ".com", ".io"];

/** Tiempo máximo por lookup DNS antes de marcarlo como inconcluso (ms). */
const LOOKUP_TIMEOUT_MS = 4000;

/** Validación del body de entrada con Zod. */
const checkBodySchema = z.object({
  names: z
    .array(z.string())
    .min(1, "Se requiere al menos un nombre")
    .max(20, "Demasiados nombres"),
});

/**
 * Resuelve un dominio vía DNS (Sistema de nombres de dominio) y deduce
 * disponibilidad:
 *   - ENOTFOUND          → probablemente disponible (true)
 *   - resuelve           → registrado (false)
 *   - otro error         → inconcluso (null)
 */
function resolveDomain(domain: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    dns.resolve4(domain, (err) => {
      if (err && err.code === "ENOTFOUND") {
        resolve(true);
      } else if (err) {
        resolve(null);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Lookup con timeout: corre el resolve DNS contra un temporizador. Si el
 * lookup tarda más de `LOOKUP_TIMEOUT_MS`, se resuelve como `null`
 * (inconcluso) para que un dominio lento no bloquee toda la respuesta.
 */
function checkDomain(domain: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, LOOKUP_TIMEOUT_MS);

    resolveDomain(domain).then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    });
  });
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de la petición inválido (JSON)" },
        { status: 400 }
      );
    }

    const parsed = checkBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Se requiere un array de nombres (names)",
        },
        { status: 400 }
      );
    }

    const { names } = parsed.data;

    // Construimos la lista completa de dominios y los sondeamos en paralelo:
    // los lookups DNS son independientes y E/S, así que awaitarlos en bucle
    // anidado (names × suffixes) serializaría decenas de round-trips sin motivo.
    const domains: string[] = [];
    for (const name of names) {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

      if (!slug) continue;

      for (const suffix of SUFFIXES) {
        domains.push(`${slug}${suffix}`);
      }
    }

    const results = await Promise.all(
      domains.map(async (domain) => ({
        domain,
        available: await checkDomain(domain),
      }))
    );

    // Servicio degradado: si TODOS o una mayoría de los lookups quedaron
    // inconclusos (null), señalamos `degraded` para que la UI muestre el
    // Fallback (Plan de contingencia) sin bloquear el flujo de naming.
    const inconclusive = results.filter((r) => r.available === null).length;
    const degraded =
      results.length > 0 && inconclusive > results.length / 2;

    if (degraded) {
      return NextResponse.json({
        results,
        degraded: true,
        message: DOMAIN_FALLBACK_MESSAGE.text,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[POST /api/domains/check]", error);
    // Aun ante un fallo inesperado, devolvemos una señal degradada en lugar
    // de un 500 opaco, para que la UI ofrezca el Fallback y no se bloquee.
    return NextResponse.json(
      {
        results: [],
        degraded: true,
        message: DOMAIN_FALLBACK_MESSAGE.text,
      },
      { status: 200 }
    );
  }
}
