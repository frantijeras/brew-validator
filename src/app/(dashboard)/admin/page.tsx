import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersTable } from "./users-table";
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
  ]);

  const invCount = (status: string) =>
    invitationGroups.find((g) => g.status === status)?._count._all ?? 0;
  const projectOwners = new Set(ideasWithProject.map((i) => i.userId));

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

      {/* Gestión de usuarios */}
      <UsersTable currentUserId={session.user.id} />

      {/* Invitaciones */}
      <InvitationsSection />
    </div>
  );
}
