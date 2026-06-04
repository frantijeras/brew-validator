interface ReportRef {
  agentName: string;
}

interface ValidationProgressProps {
  validationStatus: string;
  reports: ReportRef[];
  elapsedSeconds: number;
}

interface StepState {
  label: string;
  description: string;
  icon: StepIcon;
}

type StepIcon = "search" | "scale" | "gavel";

const STEPS: { agent: string; label: string; description: string; icon: StepIcon }[] = [
  {
    agent: "skeptic",
    label: "Escéptico",
    description: "Busca objeciones y riesgos del modelo de negocio",
    icon: "search",
  },
  {
    agent: "advocate",
    label: "Abogado del diablo",
    description: "Investiga oportunidades y ventajas competitivas",
    icon: "scale",
  },
  {
    agent: "judge",
    label: "Juez",
    description: "Sopesa argumentos y emite veredicto final",
    icon: "gavel",
  },
];

export function ValidationProgress({
  validationStatus,
  reports,
  elapsedSeconds,
}: ValidationProgressProps) {
  const isRunning = validationStatus === "RUNNING";
  const isFailed = validationStatus === "FAILED";
  const isDone = validationStatus === "DONE";

  // Determine which agents have completed
  const completedAgents = new Set(reports.map((r) => r.agentName));

  // Count how many are done
  const completedCount = STEPS.filter((s) =>
    completedAgents.has(s.agent)
  ).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">
          Progreso de validación
        </h2>
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="flex items-center gap-2 text-sm text-amber-400">
              <SpinnerIcon />
              {completedCount}/3 completados · {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {isDone && (
            <span className="text-sm text-emerald-400 font-medium">
              Completado · {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {isFailed && (
            <span className="text-sm text-red-400 font-medium">Fallido</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isDone
              ? "bg-emerald-500"
              : isFailed
                ? "bg-red-500"
                : "bg-amber-500"
          }`}
          style={{
            width: isDone
              ? "100%"
              : isFailed
                ? `${(completedCount / 3) * 100}%`
                : isRunning
                  ? `${Math.max((completedCount / 3) * 100, 8)}%`
                  : "0%",
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {STEPS.map((step, index) => {
          const isCompleted = completedAgents.has(step.agent);
          const isCurrentStep =
            isRunning && !isCompleted && index === completedCount;

          let statusIcon: React.ReactNode;
          let borderLeftColor: string;

          if (isCompleted) {
            statusIcon = <CheckIcon />;
            borderLeftColor = "border-l-emerald-500/50";
          } else if (isCurrentStep) {
            statusIcon = <SpinnerIcon />;
            borderLeftColor = "border-l-amber-500/50";
          } else if (isFailed && index === completedCount) {
            statusIcon = <XIcon />;
            borderLeftColor = "border-l-red-500/50";
          } else {
            statusIcon = <ClockIcon />;
            borderLeftColor = "border-l-slate-700";
          }

          return (
            <div
              key={step.agent}
              className={`flex items-start gap-4 p-3 rounded-lg border-l-2 transition-colors ${
                index < STEPS.length - 1 ? "border-b border-slate-800/50" : ""
              } ${borderLeftColor}`}
            >
              {/* Step icon */}
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  isCompleted
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isCurrentStep
                      ? "bg-amber-500/10 text-amber-400"
                      : isFailed && index === completedCount
                        ? "bg-red-500/10 text-red-400"
                        : "bg-slate-800 text-slate-500"
                }`}
              >
                <StepIconRenderer icon={step.icon} />
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm font-semibold ${
                      isCompleted
                        ? "text-emerald-300"
                        : isCurrentStep
                          ? "text-amber-300"
                          : isFailed && index === completedCount
                            ? "text-red-300"
                            : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </h3>
                  {statusIcon}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Icons ── */

function StepIconRenderer({ icon }: { icon: StepIcon }) {
  switch (icon) {
    case "search":
      return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "scale":
      return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M3 12h18" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case "gavel":
      return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 13l-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
          <path d="M16 16l6-6" />
          <path d="M8 8l6-6" />
          <path d="M9 7l8 8" />
          <path d="M21 11l-2-2" />
        </svg>
      );
  }
}

function CheckIcon() {
  return (
    <svg className="size-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="size-4 animate-spin text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="size-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="size-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds === 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
