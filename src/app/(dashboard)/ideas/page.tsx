import Link from "next/link";
import { prisma } from "@/lib/db";
import { IdeaCard } from "@/components/idea-card";
import { IdeasAutoRefresh } from "./auto-refresh";
import { IdeasToolbar } from "./ideas-toolbar";

export const dynamic = "force-dynamic";

type Tab = "all" | "archived";

interface Props {
  searchParams: Promise<{ tab?: string; model?: string }>;
}

export default async function IdeasPage({ searchParams }: Props) {
  const { tab: rawTab, model: rawModel } = await searchParams;
  const activeTab: Tab = rawTab === "archived" ? "archived" : "all";
  const activeModel = rawModel || "";

  const whereBase =
    activeTab === "archived"
      ? { isArchived: true }
      : { isArchived: false };

  // Exclude ideas that have been converted to projects
  const where = activeModel
    ? { ...whereBase, businessModel: activeModel, project: null }
    : { ...whereBase, project: null };

  const orderBy =
    activeTab === "all"
      ? [{ isFavorite: "desc" as const }, { updatedAt: "desc" as const }]
      : [{ updatedAt: "desc" as const }];

  const ideas = await prisma.idea.findMany({
    where,
    orderBy,
  });

  const tabLabel = activeTab === "archived" ? "Archivadas" : "Todas";

  const hasGenerating = ideas.some((i) => i.status === "GENERATING");
  const hasValidating = ideas.some((i) => i.validationStatus === "RUNNING");

  // Check for any active jobs related to displayed ideas
  const ideaIds = ideas.map((i) => i.id);
  const activeJobCount =
    ideaIds.length > 0
      ? await prisma.job.count({
          where: {
            ideaId: { in: ideaIds },
            status: { in: ["PENDING", "RUNNING"] },
          },
        })
      : 0;
  const hasActiveJobs = activeJobCount > 0;

  return (
    <div>
      <IdeasAutoRefresh
        hasGenerating={hasGenerating}
        hasValidating={hasValidating}
        hasActiveJobs={hasActiveJobs}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Ideas
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {ideas.length === 0
              ? `No hay ideas en ${tabLabel.toLowerCase()}`
              : `${ideas.length} idea${ideas.length === 1 ? "" : "s"} en ${tabLabel.toLowerCase()}`}
          </p>
        </div>
        <Link
          href="/ideas/new"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-colors hover:bg-amber-400 active:bg-amber-600"
        >
          <PlusIcon />
          Nueva idea
        </Link>
      </div>

      {/* Tabs + Filter toolbar */}
      <IdeasToolbar activeTab={activeTab} activeModel={activeModel} />

      {/* Ideas grid */}
      {ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
          <LightbulbIcon className="size-12 text-slate-600" />
          <p className="mt-4 text-sm text-slate-500">
            {activeTab === "archived"
              ? "No hay ideas archivadas"
              : "No hay ideas todavía"}
          </p>
          {activeTab === "all" && (
            <Link
              href="/ideas/new"
              className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Crear la primera idea →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea as IdeaCardData}
              showArchive
              showDelete
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Internal icon components to avoid extra imports
function PlusIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-4"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

// Match the shape we need from Prisma
interface IdeaCardData {
  id: string;
  title: string;
  status: string;
  validationStatus: string;
  verdict: string | null;
  score: number | null;
  businessModel: string | null;
  currentVersionPhase?: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
