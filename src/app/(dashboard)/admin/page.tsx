import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersTable } from "./users-table";
import { RequestsTable } from "./requests-table";
import { InvitationsSection } from "../settings/invitations-section";

export const dynamic = "force-dynamic";

/**
 * Embudo + totales (mismo cálculo que GET /api/admin/stats, resuelto en el
 * servidor directamente con prisma para no hacer un fetch interno).
 */
async function getStats() {
  const [
    invitationGroups,
    usersTotal,
    totalIdeas,
    totalProjects,
    costAgg,
    distinctIdeaOwners,
    ideasWithProject,
    costByAgentGroups,
  ] = await Promise.all([
    prisma.invitation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
    prisma.idea.count(),
    prisma.project.count(),
    prisma.job.aggregate({ _sum: { cost: true } }),
    prisma.idea.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.idea.findMany({
      where: { userId: { not: null }, project: { isNot: null } },
      select: { userId: true },
    }),
    prisma.job.groupBy({
      by: ["agentName"],
      _sum: { cost: true },
      _count: { _all: true },
    }),
  ]);

  const invCount = (status: string) =>
    invitationGroups.find((g) => g.status === status)?._count._all ?? 0;
  const projectOwners = new Set(ideasWithProject.map((i) => i.userId));

  const costByAgent = costByAgentGroups
    .map((g) => ({
      agent: g.agentName,
      cost: g._sum.cost ?? 0,
      jobs: g._count._all,
    }))
    .sort((a, b) => b.cost - a.cost);

  return {
    invitations: {
      pending: invCount("PENDING"),
      accepted: invCount("ACCEPTED"),
      revoked: invCount("REVOKED"),
    },
    users: usersTotal,
    usersWithIdea: distinctIdeaOwners.length,
    usersWithProject: projectOwners.size,
    totalIdeas,
    totalProjects,
    totalCost: costAgg._sum.cost ?? 0,
    costByAgent,
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isAdmin) redirect("/ideas");

  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Administración</h1>
        <p className="mt-1 text-sm text-slate-400">
          Usuarios, límites y métricas de uso de BrewIdea
        </p>
      </div>

      {/* Embudo de invitaciones */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Embudo de invitaciones
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Pendientes" value={stats.invitations.pending} />
          <StatCard label="Aceptadas" value={stats.invitations.accepted} />
          <StatCard label="Revocadas" value={stats.invitations.revoked} />
          <StatCard
            label="Con idea"
            value={stats.usersWithIdea}
            hint={`de ${stats.users} usuarios`}
          />
          <StatCard
            label="Con proyecto"
            value={stats.usersWithProject}
            hint={`de ${stats.users} usuarios`}
          />
        </div>
      </section>

      {/* Totales globales */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Totales
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Usuarios" value={stats.users} />
          <StatCard label="Ideas" value={stats.totalIdeas} />
          <StatCard label="Proyectos" value={stats.totalProjects} />
          <StatCard label="Coste IA total" value={`$${stats.totalCost.toFixed(4)}`} />
        </div>
      </section>

      {/* Coste por agente */}
      {stats.costByAgent.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Coste por agente</h2>
          <p className="mt-1 text-sm text-slate-400">
            Gasto de IA acumulado por agente/modelo
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Agente</th>
                  <th className="px-3 py-2 text-right font-medium">Jobs</th>
                  <th className="px-3 py-2 text-right font-medium">Coste</th>
                </tr>
              </thead>
              <tbody>
                {stats.costByAgent.map((c) => (
                  <tr
                    key={c.agent}
                    className="border-b border-slate-800/60 hover:bg-slate-800/20"
                  >
                    <td className="px-3 py-2.5 text-slate-200">{c.agent}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">
                      {c.jobs}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                      ${c.cost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Solicitudes de ampliación */}
      <RequestsTable />

      {/* Gestión de usuarios */}
      <UsersTable currentUserId={session.user.id} />

      {/* Invitaciones */}
      <InvitationsSection />
    </div>
  );
}
