import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderKanban, CheckCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const projects = await prisma.project.findMany({
    include: {
      idea: true,
      phases: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {projects.length === 0
              ? "Tus ideas convertidas en proyectos ejecutables"
              : `${projects.length} proyecto${projects.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
          <FolderKanban className="size-12 text-slate-600" />
          <p className="mt-4 text-sm text-slate-500">No hay proyectos todavía</p>
          <p className="mt-1 text-xs text-slate-600">
            Completa una idea y conviértela en proyecto para empezar
          </p>
          <Link
            href="/ideas"
            className="mt-6 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Ir a ideas →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const total = project.phases.length;
            const completed = project.phases.filter((p) => p.status === "COMPLETED").length;
            const allDone = completed === total;

            return (
              <Link
                key={project.id}
                href={`/proyectos/${project.id}`}
                className="group block rounded-xl border border-slate-700 bg-slate-900/50 p-5 transition-all hover:border-slate-600 hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2.5 ${
                    allDone ? "bg-green-500/10" : "bg-amber-500/10"
                  }`}>
                    {allDone ? (
                      <CheckCircle className="size-5 text-green-400" />
                    ) : (
                      <Clock className="size-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {completed}/{total} fases completadas
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            allDone ? "bg-green-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${(completed / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {Math.round((completed / total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
