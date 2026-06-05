import Link from "next/link";
import { FolderKanban } from "lucide-react";

export default function ProyectosPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Tus ideas convertidas en proyectos ejecutables
          </p>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
        <FolderKanban className="size-12 text-slate-600" />
        <p className="mt-4 text-sm text-slate-500">Próximamente</p>
        <p className="mt-1 text-xs text-slate-600">
          Aquí gestionarás tus proyectos con fases de branding, estrategia,
          contenido y desarrollo
        </p>
        <Link
          href="/ideas"
          className="mt-6 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          ← Volver a ideas
        </Link>
      </div>
    </div>
  );
}
