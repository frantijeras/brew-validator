import Link from "next/link";
import { CREATOR } from "@/lib/terms";

/**
 * Footer pequeño y discreto para la demo. Recuerda que es un prototipo de
 * acceso privado y enlaza a los términos.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-800 pt-6 pb-2 text-center text-xs text-slate-500">
      <p>
        © {CREATOR} ·{" "}
        <Link
          href="/terms"
          className="text-slate-400 underline transition-colors hover:text-amber-400"
        >
          Términos
        </Link>
      </p>
      <p className="mt-1 text-slate-600">
        Versión prototipo · acceso privado por invitación · los datos pueden
        usarse para mejorar la app
      </p>
    </footer>
  );
}
