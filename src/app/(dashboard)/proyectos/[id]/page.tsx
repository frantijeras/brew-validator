import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProyectoDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div>
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        Volver a proyectos
      </Link>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
        <p className="text-sm text-slate-500">
          Proyecto <span className="font-mono text-slate-400">{id}</span>
        </p>
        <p className="mt-1 text-xs text-slate-600">Próximamente</p>
      </div>
    </div>
  );
}
