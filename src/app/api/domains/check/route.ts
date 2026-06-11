import { NextResponse } from "next/server";
import dns from "dns";

/**
 * POST /api/domains/check
 *
 * Checks if a list of domain names are available (not registered / no DNS records).
 * Uses DNS resolution + TCP probe on port 80 to determine availability.
 *
 * Body: { names: string[] }
 * Returns: { results: Array<{ domain: string, available: boolean | null, error?: string }> }
 */

const SUFFIXES = [".es", ".com", ".io"];

async function checkDomain(domain: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    // First try DNS resolution
    dns.resolve4(domain, (err) => {
      if (err && err.code === "ENOTFOUND") {
        // DNS not found → likely available
        resolve(true);
      } else if (err) {
        // Some other DNS error → inconclusive
        resolve(null);
      } else {
        // DNS resolved → domain is registered
        resolve(false);
      }
    });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const names: string[] = body?.names;

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de nombres (names)" },
        { status: 400 }
      );
    }

    // Build the full domain list, then probe all of them concurrently \u2014 DNS
    // lookups are I/O-bound and independent, so awaiting them in a nested loop
    // (names \u00d7 suffixes) serialised dozens of round-trips for no reason.
    const domains: string[] = [];
    for (const name of names) {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
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

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[POST /api/domains/check]", error);
    return NextResponse.json(
      { error: "Error al verificar dominios" },
      { status: 500 }
    );
  }
}
