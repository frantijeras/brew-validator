"use client";

import * as React from "react";

/**
 * ElapsedCounter — contador de tiempo en vivo `mm:ss` que cuenta desde un
 * instante de inicio (`since`). Sustituye a las ETAs fijas tipo "~2-3 min":
 * en vez de prometer una duración, muestra el tiempo REAL transcurrido desde
 * que la fase/sub-paso entró en PROCESSING.
 *
 * - `since` puede ser un ISO string o epoch en ms. Normalmente es
 *   `phase.updatedAt` (el momento en que el registro pasó a PROCESSING).
 * - Para evitar desajustes de hidratación (server vs client), no calcula nada
 *   hasta montar en el cliente; antes de eso renderiza un placeholder estable.
 * - Tras horas, sigue funcionando: si supera 60 min muestra `h:mm:ss`.
 */
export function ElapsedCounter({
  since,
  className,
}: {
  since: string | number | Date | null | undefined;
  className?: string;
}) {
  const startMs = React.useMemo(() => {
    if (since == null) return null;
    const d = since instanceof Date ? since : new Date(since);
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  }, [since]);

  const [nowMs, setNowMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (startMs == null) return;
    // Primer tick inmediato al montar (cliente), luego cada segundo.
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  // Placeholder estable hasta montar (SSR) o si no hay inicio válido.
  if (startMs == null || nowMs == null) {
    return <span className={className}>0:00</span>;
  }

  const totalSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const text =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <span className={className} aria-label={`Tiempo transcurrido ${text}`}>
      {text}
    </span>
  );
}
