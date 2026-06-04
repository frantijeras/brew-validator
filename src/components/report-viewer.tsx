"use client";

import { useState } from "react";
import { renderMarkdown } from "./markdown-renderer";

interface ReportData {
  id: string;
  agentName: string;
  title: string;
  content: string;
  verdict: string | null;
  scorecard: string | null;
  createdAt: string;
}

interface ReportViewerProps {
  report: ReportData;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const [open, setOpen] = useState(true);

  // Omit idea-generator reports — the original idea is already shown above
  if (report.agentName === "idea-generator" || report.agentName === "Generador de ideas") {
    return null;
  }

  const agentLabel =
    report.agentName === "skeptic"
      ? "Escéptico"
      : report.agentName === "advocate"
        ? "Defensor"
        : report.agentName === "judge"
          ? "Juez"
          : report.agentName === "idea-generator"
            ? "Generador de ideas"
            : report.agentName;

  const agentIcon =
    report.agentName === "skeptic"
      ? "search"
      : report.agentName === "advocate"
        ? "scale"
        : report.agentName === "judge"
          ? "gavel"
          : report.agentName === "idea-generator"
            ? "lightbulb"
            : "file";

  const agentColor =
    report.agentName === "skeptic"
      ? "amber"
      : report.agentName === "advocate"
        ? "sky"
        : report.agentName === "judge"
          ? "violet"
          : report.agentName === "idea-generator"
            ? "yellow"
            : "slate";

  const htmlContent = renderMarkdown(report.content);

  // Detect JSON content from idea-generator
  const ideaJson = parseIdeaJson(report.content);

  // Parse scorecard
  const scorecard = parseScorecard(report.scorecard);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex size-8 items-center justify-center rounded-lg bg-${agentColor}-500/10 text-${agentColor}-400`}
          >
            <AgentIcon icon={agentIcon} color={agentColor} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{agentLabel}</h3>
            <p className="text-xs text-slate-500">
              {report.title} ·{" "}
              {new Date(report.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <ChevronIcon open={open} />
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-slate-800 px-6 py-5">
          {/* Tabla resumen de puntuación */}
          {scorecard && scorecard.length > 0 && (
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Puntuación
              </h4>

              {/* Summary table — all dimensions in rows */}
              <div className="mb-4 overflow-hidden rounded-lg border border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/50">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-200">
                        Dimensión
                      </th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-200 w-20">
                        Puntuación
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorecard.map((item, i) => {
                      const isLast = i === scorecard.length - 1;
                      const isTotal =
                        item.key.toLowerCase() === "total" ||
                        item.key.toLowerCase() === "total score" ||
                        item.key.toLowerCase() === "puntuación total";
                      return (
                        <tr
                          key={item.key}
                          className={`${
                            isTotal
                              ? "bg-slate-800/50 font-bold"
                              : ""
                          } ${isLast ? "" : "border-b border-slate-800"}`}
                        >
                          <td
                            className={`px-4 py-2.5 ${
                              isTotal ? "text-white" : "text-slate-300"
                            }`}
                          >
                            {item.key}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-center tabular-nums ${
                              isTotal
                                ? "text-amber-400 font-bold"
                                : "text-slate-400"
                            }`}
                          >
                            {formatScore(item.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Desglose — lista */}
              {scorecard.length > 0 && (
                <ul className="space-y-2">
                  {scorecard.map((item) => {
                    const isTotal =
                      item.key.toLowerCase() === "total" ||
                      item.key.toLowerCase() === "total score" ||
                      item.key.toLowerCase() === "puntuación total";
                    if (isTotal) return null;
                    const explanation = extractDimensionExplanation(report.content, item.key);
                    const scoreNum = typeof item.value === "number" ? item.value : parseFloat(String(item.value));
                    const scoreLabel = !isNaN(scoreNum) ? `${scoreNum}/10` : String(item.value);
                    return (
                      <li key={item.key} className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-slate-200">{item.key}:</strong>{" "}
                        <span className="text-amber-400 font-semibold tabular-nums">{scoreLabel}</span>
                        {explanation && (
                          <>
                            {" "}—{" "}
                            <span className="text-slate-400">{explanation}</span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Content - idea JSON or markdown */}
          {ideaJson ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
              <h4 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                {ideaJson.title}
              </h4>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Descripción
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    {ideaJson.description}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Target
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    {ideaJson.targetUser}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Monetización
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    {ideaJson.monetization}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Puntuación
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-amber-400">
                    {ideaJson.score}/10
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none
                prose-headings:text-white prose-p:text-slate-300
                prose-strong:text-slate-200 prose-li:text-slate-300
                prose-a:text-amber-400 prose-code:text-amber-300
                prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

interface IdeaJson {
  title: string;
  description: string;
  targetUser: string;
  monetization: string;
  score: number;
}

function parseIdeaJson(content: string): IdeaJson | null {
  if (!content || !content.trim().startsWith("{")) return null;

  try {
    const parsed = JSON.parse(content);

    // Handle {"ideas": [{...}]}
    if (parsed.ideas && Array.isArray(parsed.ideas) && parsed.ideas.length > 0) {
      const idea = parsed.ideas[0];
      return {
        title: idea.title ?? idea.name ?? "Sin título",
        description: idea.description ?? "",
        targetUser: idea.targetUser ?? idea.target ?? "",
        monetization: idea.monetization ?? "",
        score: typeof idea.score === "number" ? idea.score : 0,
      };
    }

    // Handle direct idea object
    if (parsed.title || parsed.description || parsed.targetUser || parsed.monetization) {
      return {
        title: parsed.title ?? parsed.name ?? "Sin título",
        description: parsed.description ?? "",
        targetUser: parsed.targetUser ?? parsed.target ?? "",
        monetization: parsed.monetization ?? "",
        score: typeof parsed.score === "number" ? parsed.score : 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseScorecard(
  scorecard: string | null
): { key: string; value: number | string }[] {
  if (!scorecard) return [];

  try {
    const parsed = JSON.parse(scorecard);
    if (Array.isArray(parsed)) {
      const result: { key: string; value: string | number }[] = [];
      for (const item of parsed) {
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length > 0) {
            const val = entries[0][1];
            result.push({
              key: String(entries[0][0]),
              value: typeof val === "number" || typeof val === "string" ? val : String(val),
            });
          }
        } else {
          result.push({ key: String(item), value: 0 });
        }
      }
      return result;
    }

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return Object.entries(obj).map(([key, value]) => ({
        key,
        value: typeof value === "number" || typeof value === "string" ? value : String(value),
      }));
    }
  } catch {
    // Not JSON, try line-by-line
    return scorecard
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(":");
        return {
          key: parts[0]?.trim() ?? "",
          value: parts[1]?.trim() ?? 0,
        };
      });
  }

  return [];
}

function formatScore(value: number | string): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
}

/**
 * Try to extract a per-dimension explanation from the report markdown.
 * Looks for lines like "**Problema:** …" or "- **Problema**: …"
 */
function extractDimensionExplanation(content: string, dimension: string): string {
  const patterns = [
    new RegExp(`\\*\\*${escapeRegex(dimension)}\\s*[:：]?\\*\\*\\s*(.+?)(?:\\n|$)`, "i"),
    new RegExp(`^\\s*-\\s+\\*\\*${escapeRegex(dimension)}\\s*[:：]?\\*\\*\\s*(.+?)(?:\\n|$)`, "im"),
    new RegExp(`${escapeRegex(dimension)}\\s*[:：]\\s*([0-9]+(?:\\.[0-9]+)?)\\/10\\s*[—-]?\\s*(.+?)(?:\\n|$)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const explanation = (match[1] || match[2] || "").trim();
      if (explanation && explanation.length > 3) return explanation;
    }
  }

  return "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ── Icons ── */

function AgentIcon({
  icon,
  color,
}: {
  icon: string;
  color: string;
}) {
  const className = `size-4 text-${color}-400`;

  switch (icon) {
    case "search":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "scale":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M3 12h18" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case "gavel":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 13l-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
          <path d="M16 16l6-6" />
          <path d="M8 8l6-6" />
          <path d="M9 7l8 8" />
          <path d="M21 11l-2-2" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17h8v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
