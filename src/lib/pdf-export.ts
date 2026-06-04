import { jsPDF } from "jspdf";

/* ── Type matching the export API response ── */

interface ExportData {
  title: string;
  description: string;
  problem: string;
  valueProposition: string;
  targetUser: string;
  monetization: string;
  businessModel: string;
  score: number | null;
  verdict: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reports: ExportReport[];
  versions: ExportVersion[];
}

interface ExportReport {
  title: string;
  agentName: string;
  verdict: string | null;
  scorecard: string | null;
  content: string;
  createdAt: string;
}

interface ExportVersion {
  title: string;
  phase: string;
  createdAt: string;
}

/* ── Helpers ── */

const MARGIN = 20;
const PAGE_W = 210; // A4 mm
const CONTENT_W = PAGE_W - MARGIN * 2;

function agentLabel(name: string): string {
  switch (name) {
    case "skeptic":
      return "Escéptico";
    case "advocate":
      return "Defensor";
    case "judge":
      return "Juez";
    case "idea-generator":
      return "Generador de ideas";
    default:
      return name;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^>\s+/gm, "  ")
    .trim();
}

/* ── Main generator ── */

export function generatePdf(filename: string, data: ExportData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const pageH = doc.internal.pageSize.getHeight();

  function checkSpace(needed: number): void {
    if (y + needed > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function bold(text: string): void {
    doc.setFont("helvetica", "bold");
    doc.text(text, MARGIN, y);
    doc.setFont("helvetica", "normal");
  }

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);

  // Wrap title
  const titleLines = doc.splitTextToSize(data.title, CONTENT_W);
  checkSpace(6 + titleLines.length * 8);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 8 + 4;

  // ── Info grid ──
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const infoLines = [
    `Modelo de negocio: ${data.businessModel}`,
    `Score: ${data.score !== null ? `${data.score}/10` : "—"}  |  Veredicto: ${data.verdict ?? "—"}`,
    `Creada: ${data.createdAt}`,
  ];
  for (const line of infoLines) {
    checkSpace(5);
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 3;

  // ── Horizontal rule ──
  checkSpace(3);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Section: Descripción ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  checkSpace(10);
  doc.text("Descripción", MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const descLines = doc.splitTextToSize(data.description, CONTENT_W);
  checkSpace(descLines.length * 5 + 4);
  doc.text(descLines, MARGIN, y);
  y += descLines.length * 5 + 6;

  // ── Section: Detalles ──
  const detailSections = [
    { label: "Problema", value: data.problem },
    { label: "Propuesta de valor", value: data.valueProposition },
    { label: "Usuario objetivo", value: data.targetUser },
    { label: "Monetización", value: data.monetization },
  ];

  for (const section of detailSections) {
    checkSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(section.label, MARGIN, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(section.value, CONTENT_W);
    checkSpace(lines.length * 4 + 3);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4 + 5;
  }

  // ── Horizontal rule ──
  checkSpace(5);
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Section: Reportes ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  checkSpace(10);
  doc.text("Reportes", MARGIN, y);
  y += 8;

  for (const report of data.reports) {
    const label = agentLabel(report.agentName);

    // Check if we need a new page for this report
    checkSpace(30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${label}  —  ${report.title}`, MARGIN, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${report.createdAt}${report.verdict ? `  ·  Veredicto: ${report.verdict}` : ""}`, MARGIN, y);
    y += 6;

    const cleaned = stripMarkdown(report.content);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const contentLines = doc.splitTextToSize(cleaned, CONTENT_W);
    checkSpace(contentLines.length * 4 + 6);
    doc.text(contentLines, MARGIN, y);
    y += contentLines.length * 4 + 6;

    // thin separator between reports
    checkSpace(3);
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  }

  // ── Section: Historial de versiones ──
  if (data.versions.length > 0) {
    checkSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Historial de versiones", MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const v of data.versions) {
      checkSpace(5);
      doc.setTextColor(50, 50, 50);
      doc.text(`• ${v.title} (${v.phase}) — ${v.createdAt}`, MARGIN, y);
      y += 5;
    }
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Brew Validator · Informe generado el ${new Date().toLocaleDateString("es-ES")}`,
      MARGIN,
      pageH - 8
    );
    doc.text(`Pág. ${i} / ${totalPages}`, PAGE_W - MARGIN, pageH - 8, { align: "right" });
  }

  doc.save(filename);
}
