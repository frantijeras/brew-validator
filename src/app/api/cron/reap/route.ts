import { NextResponse } from "next/server";
import { reapStuckProcesses } from "@/lib/bridge/reaper";

/**
 * GET /api/cron/reap
 *
 * Saneado periódico (Vercel Cron, cada 5 min — ver vercel.json) que limpia los
 * procesos colgados de TODOS los proyectos, aunque nadie los esté mirando.
 * Complementa el saneado "lazy" que ocurre al abrir un proyecto.
 *
 * Protección: si `CRON_SECRET` está definido, exige `Authorization: Bearer
 * <CRON_SECRET>` (Vercel Cron lo envía automáticamente). Sin secreto, queda
 * abierto (best-effort) — el endpoint solo limpia estados colgados, no expone
 * datos.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await reapStuckProcesses();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[GET /api/cron/reap]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
