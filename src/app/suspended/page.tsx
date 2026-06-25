import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-500/10">
          <ShieldAlert className="size-6 text-red-400" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-white">Acceso suspendido</h1>
        <p className="mt-2 text-sm text-slate-400">
          Tu acceso está suspendido. Contacta con el administrador.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
