/**
 * E2E real idea→handoff contra la app desplegada (brew-validator.vercel.app).
 *
 * - Conduce la UI con Playwright (clicks reales + screenshots) para detectar
 *   problemas visuales/funcionales.
 * - Sincroniza con la BD (Prisma) para esperar a que el Bridge procese cada
 *   job (mucho más fiable que raspar el DOM con el modelo gratis, que es lento).
 * - Captura errores de consola, excepciones de página y peticiones fallidas.
 *
 * Resumible por variables de entorno:
 *   E2E_IDEA_ID, E2E_PROJECT_ID  → reanudar con idea/proyecto existentes
 *   E2E_MAX_STAGE                → A=1 B=2 C=3 D=4 E=5 F=6 G=7 (default 7)
 *   E2E_HEADLESS=0               → ver el navegador
 *
 * Artefactos: e2e-artifacts/  (screenshots NN-*.png, timeline.json, summary.json)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ── cargar .env.local ──
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const k = t.slice(0, i).trim();
  const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!(k in process.env)) process.env[k] = v;
}

const { chromium } = await import("playwright");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const BASE = process.env.E2E_BASE || "https://brew-validator.vercel.app";
const STAMP = process.env.E2E_STAMP || "20260613";
const EMAIL = `e2e-bot-${STAMP}@test.local`;
const PASSWORD = "E2eBot!" + STAMP;
const MAX_STAGE = Number(process.env.E2E_MAX_STAGE || 7);
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const ART = resolve("e2e-artifacts");
mkdirSync(ART, { recursive: true });
mkdirSync(resolve(ART, "downloads"), { recursive: true });

// ── estado / logging ──
const timeline = [];
const issues = [];
let shotN = 0;
const t0 = Date.now();
function now() { return ((Date.now() - t0) / 1000).toFixed(1) + "s"; }
function log(stage, msg, level = "info") {
  const rec = { t: now(), stage, level, msg };
  timeline.push(rec);
  const tag = level === "error" ? "❌" : level === "warn" ? "⚠️ " : level === "ok" ? "✅" : "  ";
  console.log(`[${now().padStart(7)}] ${tag} ${stage}: ${msg}`);
  flush();
}
function issue(stage, severity, title, detail) {
  issues.push({ stage, severity, title, detail, t: now() });
  log(stage, `${severity.toUpperCase()} — ${title}${detail ? " :: " + detail : ""}`, severity === "info" ? "warn" : "error");
}
function flush() {
  try {
    writeFileSync(resolve(ART, "timeline.json"), JSON.stringify({ base: BASE, email: EMAIL, timeline, issues }, null, 2));
  } catch {}
}

let page;
async function shot(name) {
  shotN++;
  const file = resolve(ART, `${String(shotN).padStart(2, "0")}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    log("shot", `${String(shotN).padStart(2, "0")}-${name}.png`);
  } catch (e) {
    log("shot", `fallo screenshot ${name}: ${e.message}`, "warn");
  }
}

async function poll(fn, { timeoutMs, intervalMs = 4000, label }) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try { last = await fn(); } catch (e) { last = undefined; }
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando: ${label} (${(timeoutMs / 1000) | 0}s)`);
}

async function clickAny(labels, { timeout = 8000 } = {}) {
  for (const label of labels) {
    const byRole = page.getByRole("button", { name: label, exact: false });
    if (await byRole.count()) {
      try { await byRole.first().click({ timeout }); return label; } catch {}
    }
    const byText = page.getByText(label, { exact: false });
    if (await byText.count()) {
      try { await byText.first().click({ timeout }); return label; } catch {}
    }
  }
  return null;
}

// ── attach listeners ──
function attach() {
  page.on("pageerror", (err) => issue("runtime", "high", "Excepción JS en página", `${page.url()} :: ${err.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const txt = m.text();
      // Ignora ruido conocido de extensiones / source maps
      if (/Failed to load resource.*favicon|sourcemap/i.test(txt)) return;
      issue("console", "medium", "console.error", txt.slice(0, 300));
    }
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.startsWith(BASE) && /\/api\//.test(u)) {
      issue("network", "medium", "Petición API fallida", `${req.method()} ${u.replace(BASE, "")} :: ${req.failure()?.errorText}`);
    }
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (u.startsWith(BASE) && /\/api\//.test(u) && res.status() >= 500) {
      issue("network", "high", `API ${res.status()}`, `${res.request().method()} ${u.replace(BASE, "")}`);
    }
  });
}

// ── stages ──
const PHASE_ORDER = ["ANALYSIS", "BUSINESS", "IDENTITY", "CONTENT", "EXECUTION"];

async function login() {
  log("login", `→ ${BASE}/login como ${EMAIL}`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await shot("login-form");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.getByRole("button", { name: /Entrar/i }).click(),
  ]);
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) {
    const err = await page.getByText(/Credenciales inválidas/i).count();
    throw new Error("Login falló" + (err ? " (credenciales inválidas)" : ` (sigue en ${page.url()})`));
  }
  log("login", "sesión iniciada", "ok");
  await shot("after-login");
}

async function ensureIdea() {
  let ideaId = process.env.E2E_IDEA_ID;
  if (ideaId) { log("idea", `reanudando con idea ${ideaId}`); return ideaId; }

  await page.goto(`${BASE}/ideas/new`, { waitUntil: "networkidle", timeout: 60000 });
  await shot("idea-new");
  await clickAny(["Idea personalizada"]);
  await page.waitForTimeout(800);
  // seleccionar modelo de negocio (dropdown custom, allowAny=false)
  await clickAny(["Elige un modelo de negocio"]);
  await page.waitForTimeout(400);
  const opt = page.getByRole("button", { name: "SaaS", exact: true });
  if (await opt.count()) await opt.first().click();
  await page.waitForTimeout(300);
  const raw =
    "Plataforma SaaS que ayuda a pequenas agencias de marketing a automatizar " +
    "los informes mensuales de resultados para sus clientes, integrando Google " +
    "Analytics, Meta Ads y Google Ads en un panel unico con marca blanca.";
  await page.fill("#rawIdea", raw);
  await shot("idea-filled");
  await clickAny(["Reformular con IA", "Generar idea"]);
  log("idea", "idea enviada, esperando al Bridge (idea-generator)…");

  // localizar la idea recién creada del usuario
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const created = await poll(async () => {
    const i = await prisma.idea.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return i && (i.status === "GENERATING" || i.status === "DRAFT") ? i : null;
  }, { timeoutMs: 60000, label: "idea creada en BD" });
  ideaId = created.id;
  log("idea", `idea ${ideaId} creada (status=${created.status})`);

  const ready = await poll(async () => {
    const i = await prisma.idea.findUnique({ where: { id: ideaId } });
    const failed = await prisma.job.findFirst({ where: { ideaId, agentName: "idea-generator", status: "FAILED" } });
    if (failed) throw new Error("job idea-generator FAILED: " + (failed.error || "").slice(0, 200));
    return i && i.status !== "GENERATING" ? i : null;
  }, { timeoutMs: 6 * 60000, intervalMs: 5000, label: "idea generada (status≠GENERATING)" });
  log("idea", `idea lista: "${ready.title}" (status=${ready.status})`, "ok");
  return ideaId;
}

async function validateIdea(ideaId) {
  await page.goto(`${BASE}/ideas/${ideaId}`, { waitUntil: "networkidle", timeout: 60000 });
  await shot("idea-detail");
  const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
  if (idea.validationStatus && !["PENDING", "GENERATING"].includes(idea.validationStatus)) {
    log("validate", `ya validada (validationStatus=${idea.validationStatus}), salto`, "ok");
    return;
  }
  const clicked = await clickAny(["Validar esta idea", "Validar con IA", "Validar"]);
  if (!clicked) issue("validate", "high", "No encuentro el botón de Validar", "en /ideas/[id]");
  log("validate", "validación lanzada, esperando a escéptico→defensor→juez…");
  await page.waitForTimeout(3000);
  await shot("validate-running");
  const done = await poll(async () => {
    const i = await prisma.idea.findUnique({ where: { id: ideaId } });
    const failed = await prisma.job.findFirst({
      where: { ideaId, agentName: { in: ["skeptic", "advocate", "judge", "validator"] }, status: "FAILED" },
    });
    if (failed) issue("validate", "high", `job ${failed.agentName} FAILED`, (failed.error || "").slice(0, 200));
    return i && !["PENDING", "GENERATING", "VALIDATING", "IN_PROGRESS", "PROCESSING"].includes(i.validationStatus) ? i : null;
  }, { timeoutMs: 10 * 60000, intervalMs: 6000, label: "validación terminada" });
  log("validate", `validación: validationStatus=${done.validationStatus}`, "ok");
  await page.goto(`${BASE}/ideas/${ideaId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot("validate-done");
}

async function createProject(ideaId) {
  let projectId = process.env.E2E_PROJECT_ID;
  const existing = await prisma.project.findUnique({ where: { ideaId } }).catch(() => null);
  if (existing) projectId = existing.id;
  if (!projectId) {
    await page.goto(`${BASE}/ideas/${ideaId}`, { waitUntil: "networkidle", timeout: 60000 });
    const clicked = await clickAny(["Crear proyecto", "Crear Proyecto"]);
    if (!clicked) issue("project", "high", "No encuentro el botón Crear proyecto", "en /ideas/[id]");
    const proj = await poll(async () => prisma.project.findUnique({ where: { ideaId } }),
      { timeoutMs: 60000, label: "proyecto creado en BD" });
    projectId = proj.id;
  }
  log("project", `proyecto ${projectId}`);
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot("project-overview");
  const phases = await prisma.projectPhase.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" } });
  log("project", `fases: ${phases.map((p) => `${p.sortOrder}:${p.type}=${p.status}`).join(", ")}`);
  return projectId;
}

async function phaseRow(projectId, type) {
  return prisma.projectPhase.findFirst({ where: { projectId, type } });
}

// Fase estándar (ANALYSIS, BUSINESS, CONTENT, EXECUTION): Iniciar → preguntas → Responder → Generar informe → COMPLETED
async function runStandardPhase(projectId, type) {
  let ph = await phaseRow(projectId, type);
  if (!ph) { issue("phase", "high", `Fase ${type} no existe`, ""); return; }
  if (ph.status === "COMPLETED") { log(type, "ya COMPLETED, salto", "ok"); return; }
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // 1) Iniciar fase (si AVAILABLE)
  if (ph.status === "AVAILABLE") {
    const clicked = await clickAny(["Iniciar fase"]);
    if (!clicked) issue(type, "high", "No encuentro 'Iniciar fase'", `status=${ph.status}`);
    log(type, "fase iniciada, generando preguntas…");
    ph = await poll(async () => {
      const p = await phaseRow(projectId, type);
      return p && ["QUESTIONING", "COMPLETED", "PROCESSING"].includes(p.status) ? p : null;
    }, { timeoutMs: 6 * 60000, intervalMs: 5000, label: `${type}: preguntas generadas` });
    log(type, `estado tras iniciar: ${ph.status}`);
  }

  // 2) Responder wizard
  if (ph.status === "QUESTIONING") {
    await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await clickAny(["Responder"]);
    await page.waitForTimeout(1200);
    await shot(`${type}-wizard`);
    await answerWizard(type);
    log(type, "respuestas enviadas, generando informe…");
  }

  // 3) esperar COMPLETED
  const done = await poll(async () => {
    const p = await phaseRow(projectId, type);
    const failed = await prisma.job.findFirst({ where: { ideaId: (await prisma.project.findUnique({ where: { id: projectId } })).ideaId, status: "FAILED" } });
    return p && p.status === "COMPLETED" ? p : null;
  }, { timeoutMs: 12 * 60000, intervalMs: 6000, label: `${type}: COMPLETED` });
  log(type, "COMPLETED", "ok");
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(`${type}-completed`);
}

// Recorre las preguntas del wizard respondiendo genéricamente.
async function answerWizard(tag) {
  for (let step = 0; step < 12; step++) {
    await page.waitForTimeout(500);
    // ¿estamos en el resumen? botón "Generar informe"
    const gen = page.getByRole("button", { name: /Generar informe/i });
    if (await gen.count()) {
      await gen.first().click().catch(() => {});
      return;
    }
    // responder la tarjeta visible
    const radios = page.locator('input[type="radio"]');
    const checks = page.locator('input[type="checkbox"]');
    const textareas = page.locator("textarea");
    if (await radios.count()) {
      await radios.first().check().catch(() => {});
    } else if (await checks.count()) {
      await checks.first().check().catch(() => {});
    } else if (await textareas.count()) {
      await textareas.first().fill("Respuesta de prueba automatizada para el flujo E2E. Contexto: agencia de marketing pequena, B2B, presupuesto ajustado.").catch(() => {});
    }
    await page.waitForTimeout(300);
    // avanzar
    const next = page.getByRole("button", { name: /Siguiente|Continuar|Generar informe/i });
    if (await next.count()) {
      await next.first().click().catch(() => {});
    } else {
      issue(tag, "medium", "Wizard: sin botón Siguiente/Generar", `step ${step}`);
      break;
    }
  }
}

// Fase IDENTITY: naming → voice → logo → visual
async function runIdentity(projectId) {
  const type = "IDENTITY";
  let ph = await phaseRow(projectId, type);
  if (!ph) { issue(type, "high", "Fase IDENTITY no existe", ""); return; }
  if (ph.status === "COMPLETED") { log(type, "ya COMPLETED, salto", "ok"); return; }

  const subs = ["naming", "voice", "logo", "visual"];
  for (const sub of subs) {
    ph = await phaseRow(projectId, type);
    if (ph.status === "COMPLETED") break;
    log(type, `--- sub-fase ${sub} ---`);
    await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);

    // lanzar la sub-fase (botón "Iniciar" en la SubStepCard correspondiente).
    // Si ya está SUBSTEP_READY para este sub, saltamos el lanzamiento.
    const needLaunch = !(ph.status === "SUBSTEP_READY" && ph.subStep === sub);
    if (needLaunch) {
      // hay varias "Iniciar"; elegimos por proximidad al label de la sub-fase
      const launched = await launchSubstep(sub);
      if (!launched) issue(type, "high", `No pude lanzar sub-fase ${sub}`, `status=${ph.status}`);
      else log(type, `${sub} lanzada, esperando artefacto…`);
      ph = await poll(async () => {
        const p = await phaseRow(projectId, type);
        return p && (p.subStep === sub && p.status === "SUBSTEP_READY") ? p :
          (p.status === "COMPLETED" ? p : null);
      }, { timeoutMs: 10 * 60000, intervalMs: 6000, label: `${type}/${sub}: SUBSTEP_READY` });
      if (ph.status === "COMPLETED") break;
    }
    await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await shot(`identity-${sub}-ready`);

    // abrir el modal de revisión y elegir
    await openSubstepReview(sub);
    await page.waitForTimeout(1500);
    await shot(`identity-${sub}-modal`);
    await chooseInSubstepModal(sub);
    log(type, `${sub}: elección confirmada, procesando…`);

    // esperar a que avance (subStep cambie o fase complete)
    await poll(async () => {
      const p = await phaseRow(projectId, type);
      if (sub === "visual") return p.status === "COMPLETED" ? p : null;
      const nextSub = subs[subs.indexOf(sub) + 1];
      return (p.subStep === nextSub || p.status === "COMPLETED") ? p : null;
    }, { timeoutMs: 8 * 60000, intervalMs: 6000, label: `${type}/${sub}: avanzó` }).catch((e) => {
      issue(type, "high", `${sub} no avanzó`, e.message);
    });
  }
  const done = await phaseRow(projectId, type);
  if (done.status === "COMPLETED") log(type, "IDENTITY COMPLETED", "ok");
  else issue(type, "high", "IDENTITY no llegó a COMPLETED", `status=${done.status} subStep=${done.subStep}`);
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot("identity-final");
}

async function launchSubstep(sub) {
  // Las SubStepCards muestran su label; el botón "Iniciar" está dentro de la card.
  const labelMap = { naming: "Naming", voice: "Voz y Tono", logo: "Logotipo", visual: "Estilo Visual" };
  const cardLabel = labelMap[sub];
  // localizar la card por su texto y clicar su botón Iniciar
  const card = page.locator("div", { hasText: cardLabel }).filter({ has: page.getByRole("button", { name: /Iniciar/i }) });
  if (await card.count()) {
    const btn = card.last().getByRole("button", { name: /Iniciar/i });
    if (await btn.count()) { try { await btn.first().click(); return true; } catch {} }
  }
  // fallback: primer "Iniciar" disponible
  return (await clickAny(["Iniciar"])) ? true : false;
}

async function openSubstepReview(sub) {
  const reviewLabels = {
    naming: ["Revisar nombres", "Revisar"],
    voice: ["Revisar voz", "Revisar"],
    logo: ["Elegir logotipo", "Revisar"],
    visual: ["Revisar estilo", "Revisar"],
  };
  const clicked = await clickAny(reviewLabels[sub]);
  if (!clicked) issue("IDENTITY", "high", `No encuentro botón de revisión para ${sub}`, "");
}

async function chooseInSubstepModal(sub) {
  await page.waitForTimeout(800);
  if (sub === "naming") {
    // elegir la primera opción (botón con nombre); luego Confirmar elección; luego Confirmar renombrado
    const optionGrid = page.locator('div.grid button').first();
    if (await optionGrid.count()) await optionGrid.click().catch(() => {});
    await page.waitForTimeout(400);
    await clickAny(["Confirmar elección"]);
    await page.waitForTimeout(2500); // preview de renombrado
    await shot("identity-naming-rename");
    await clickAny(["Confirmar renombrado"]);
  } else if (sub === "voice") {
    // review-only: solo "Confirmar elección"
    await clickAny(["Confirmar elección"]);
  } else if (sub === "logo") {
    // elegir chip de logo (1) y "Usar logo"/"Usar este logo"
    const chip = page.getByRole("button", { name: "1", exact: true });
    if (await chip.count()) await chip.first().click().catch(() => {});
    await page.waitForTimeout(400);
    await clickAny(["Usar logo 1", "Usar este logo", "Usar logo"]);
  } else if (sub === "visual") {
    await clickAny(["Usar este estilo"]);
  }
  await page.waitForTimeout(1500);
}

async function generateSkills(projectId) {
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  // ir a la pestaña de Skills
  await clickAny(["Skills", "Herramientas", "Skills (8)"]);
  await page.waitForTimeout(1500);
  await shot("skills-tab");
  const clicked = await clickAny(["Generar las 8 skills", "Generar las", "Generar skills"]);
  if (!clicked) { issue("skills", "high", "No encuentro botón de generar skills", ""); return; }
  log("skills", "generando las 8 skills…");
  await poll(async () => {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    return p && p.handoffReady ? p : null;
  }, { timeoutMs: 6 * 60000, intervalMs: 5000, label: "skills generadas (handoffReady=true)" });
  log("skills", "skills generadas, handoffReady=true", "ok");
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await clickAny(["Skills"]);
  await page.waitForTimeout(1500);
  await shot("skills-generated");
}

async function downloadHandoff(projectId) {
  await page.goto(`${BASE}/proyectos/${projectId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await clickAny(["Hand-off", "Handoff", "Hand off"]);
  await page.waitForTimeout(1500);
  await shot("handoff-tab");
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 }).catch(() => null);
  await clickAny(["Descargar ZIP", "Descargar paquete", "Descargar Hand-off", "Descargar"]);
  const dl = await downloadPromise;
  if (dl) {
    const dest = resolve(ART, "downloads", dl.suggestedFilename() || "handoff.zip");
    await dl.saveAs(dest);
    log("handoff", `ZIP descargado: ${dl.suggestedFilename()}`, "ok");
  } else {
    issue("handoff", "high", "No se disparó la descarga del ZIP", "");
  }
}

// ── main ──
let projectId = process.env.E2E_PROJECT_ID || null;
let ideaId = process.env.E2E_IDEA_ID || null;
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
page = await ctx.newPage();
page.setDefaultTimeout(15000);
attach();

try {
  await login(); // stage A (always)
  if (MAX_STAGE >= 2) ideaId = await ensureIdea();
  if (MAX_STAGE >= 3 && ideaId) await validateIdea(ideaId);
  if (MAX_STAGE >= 4 && ideaId) projectId = await createProject(ideaId);
  if (MAX_STAGE >= 5 && projectId) {
    for (const type of PHASE_ORDER) {
      try {
        if (type === "IDENTITY") await runIdentity(projectId);
        else await runStandardPhase(projectId, type);
      } catch (e) {
        issue(type, "high", `Fase ${type} abortada`, e.message);
        await shot(`${type}-error`);
        break; // las fases posteriores están bloqueadas
      }
    }
  }
  if (MAX_STAGE >= 6 && projectId) {
    try { await generateSkills(projectId); } catch (e) { issue("skills", "high", "Skills abortado", e.message); await shot("skills-error"); }
  }
  if (MAX_STAGE >= 7 && projectId) {
    try { await downloadHandoff(projectId); } catch (e) { issue("handoff", "high", "Handoff abortado", e.message); await shot("handoff-error"); }
  }
  log("done", "flujo terminado");
} catch (e) {
  issue("fatal", "high", "Error fatal", e.message + "\n" + (e.stack || ""));
  await shot("fatal");
} finally {
  const summary = {
    base: BASE, email: EMAIL, ideaId, projectId,
    durationSec: ((Date.now() - t0) / 1000) | 0,
    screenshots: shotN,
    issuesBySeverity: issues.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {}),
    issues,
  };
  writeFileSync(resolve(ART, "summary.json"), JSON.stringify(summary, null, 2));
  flush();
  console.log("\n===== RESUMEN =====");
  console.log(`idea=${ideaId} project=${projectId} dur=${summary.durationSec}s shots=${shotN}`);
  console.log(`issues: ${JSON.stringify(summary.issuesBySeverity)}`);
  await browser.close();
  await prisma.$disconnect();
}
