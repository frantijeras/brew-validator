"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, Scale, FileText, Lightbulb } from "lucide-react";
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
      ? "shield-alert"
      : report.agentName === "advocate"
        ? "shield-check"
        : report.agentName === "judge"
          ? "scale"
          : report.agentName === "idea-generator"
            ? "lightbulb"
            : "file";

  const agentColor =
    report.agentName === "skeptic"
      ? "red"
      : report.agentName === "advocate"
        ? "emerald"
        : report.agentName === "judge"
          ? "amber"
          : report.agentName === "idea-generator"
            ? "yellow"
            : "slate";

  const htmlContent = renderMarkdown(report.content, report.agentName);

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
                      {scorecardHasDescription(scorecard) && (
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-200">
                          Justificación
                        </th>
                      )}
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
                          {scorecardHasDescription(scorecard) && (
                            <td className="px-4 py-2.5 text-slate-400 text-xs leading-relaxed">
                              {item.description || (isTotal ? "" : "—")}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Desglose — solo para NO juez (el juez ya muestra todo en la tabla) */}
              {report.agentName !== "judge" && scorecard.length > 0 && (
                <ul className="space-y-2">
                  {scorecard.map((item) => {
                    const isTotal =
                      item.key.toLowerCase() === "total" ||
                      item.key.toLowerCase() === "total score" ||
                      item.key.toLowerCase() === "puntuación total";
                    if (isTotal) return null;
                    const explanation = extractDimensionExplanation(report.content, item.key);
                    const scoreNum = typeof item.value === "number" ? item.value : parseFloat(String(item.value));
                    const scoreLabel = !isNaN(scoreNum) ? `${scoreNum.toFixed(1)}/10` : String(item.value);
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
                    {ideaJson.score.toFixed(1)}/10
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
): { key: string; value: number | string; description?: string }[] {
  if (!scorecard) return [];

  try {
    const parsed = JSON.parse(scorecard);
    if (Array.isArray(parsed)) {
      const result: { key: string; value: number | string; description?: string }[] = [];
      for (const item of parsed) {
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>;
          // New format: { key, value, description }
          if (obj.key !== undefined) {
            const val = obj.value;
            result.push({
              key: String(obj.key),
              value: typeof val === "number" || typeof val === "string" ? val : String(val),
              description: typeof obj.description === "string" ? obj.description : undefined,
            });
          } else {
            // Legacy array-of-objects: take first entry
            const entries = Object.entries(obj);
            if (entries.length > 0) {
              const val = entries[0][1];
              result.push({
                key: String(entries[0][0]),
                value: typeof val === "number" || typeof val === "string" ? val : String(val),
              });
            }
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

function scorecardHasDescription(
  scorecard: { description?: string }[]
): boolean {
  return scorecard.some((item) => item.description && item.description.trim().length > 0);
}

function formatScore(value: number | string): string {
  if (typeof value === "number") {
    return value.toFixed(1);
  }
  const num = parseFloat(String(value));
  if (!isNaN(num)) return num.toFixed(1);
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
    case "shield-alert":
      return <ShieldAlert className={className} />;
    case "shield-check":
      return <ShieldCheck className={className} />;
    case "scale":
      return <Scale className={className} />;
    case "lightbulb":
      return <Lightbulb className={className} />;
    default:
      return <FileText className={className} />;
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
