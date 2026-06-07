# Identity visual sub-step — agent contract

> **Audience:** the team that maintains the `project-branding` agent in
> the bridge repo. This document specifies what the agent must emit
> during the `visual` sub-step of the IDENTITY phase so the modal in
> `brew-validator` can render A / B / C style guides and the user can
> pick one, iterate on it or download the HTML.

The frontend (modal + download endpoint) is already implemented in
this repo:

- `src/lib/identity-visual.ts` — types, parser, helpers
- `src/app/(dashboard)/proyectos/[id]/phase-substep-modal.tsx` — UI
- `src/app/api/projects/[id]/phases/[phaseId]/substep/visual-download/route.ts`
  — HTML download endpoint

This document is the contract the agent must satisfy so the UI
behaves correctly.

---

## 1. Input the agent receives

```jsonc
{
  "mode": "questions" | "report",        // visual sub-step is always "report"
  "subStep": "visual",
  "subStepOrder": 2,
  "ideaContext": { /* project, idea, market, etc. */ },
  "previousArtifacts": [
    { "title": "Naming",  "content": "..." },  // chosen brand name + variants
    { "title": "Voz y Tono", "content": "..." } // voice/tone summary
  ]
}
```

The two `previousArtifacts` are mandatory. The agent should use the
brand name (naming) to inform logo typography choices and the
voice/tone to inform mood + palette.

---

## 2. Output the agent must emit

The agent stores its result in `ProjectPhase.subStepArtifact` exactly
like the other sub-steps:

```jsonc
{
  "type": "html",          // signal for the UI to use the visual renderer
  "content": "<JSON string with options A/B/C>",  // see section 3
  "options": null          // NOT used for visual; the A/B/C variants live
                           // inside `content.options` instead
}
```

`type: "html"` is the trigger for the modal to use the dedicated
visual sub-step renderer. (The modal also accepts `type: "json"` as a
backwards-compatible alias.)

---

## 3. Structure of the JSON inside `content`

`content` MUST be a single JSON string (escaped if necessary) with
this exact shape:

```jsonc
{
  "options": [
    {
      "variant": "A",
      "html": "<!DOCTYPE html>...full HTML document...",
      "meta": {
        "name": "Estilo A — Moderno y vibrante",
        "primaryColor": "#0F172A",
        "secondaryColor": "#F59E0B",
        "fontHeading": "Inter",
        "fontBody": "Source Sans 3",
        "mood": "moderno, vibrante, profesional"
      }
    },
    {
      "variant": "B",
      "html": "...",
      "meta": { "name": "...", "primaryColor": "...", "secondaryColor": "...", "fontHeading": "...", "fontBody": "...", "mood": "..." }
    },
    {
      "variant": "C",
      "html": "...",
      "meta": { "...": "..." }
    }
  ]
}
```

### Field requirements

| Field | Type | Required | Notes |
|---|---|---|---|
| `variant` | `"A" \| "B" \| "C"` | yes | One per option, must be unique. |
| `html` | `string` | yes | Complete HTML5 document. See section 4. |
| `meta.name` | `string` | yes | Shown on the tab. |
| `meta.primaryColor` | `string` (hex) | yes | Background / dominant color. |
| `meta.secondaryColor` | `string` (hex) | yes | Accent color. |
| `meta.fontHeading` | `string` | yes | Family name (not the full CSS). |
| `meta.fontBody` | `string` | yes | Family name. |
| `meta.mood` | `string` | yes | Short comma-separated adjectives. |

The parser is defensive: if a `meta` field is missing or invalid, it
falls back to values extracted from the HTML (palette from hex
matches, fonts from Google Fonts `family=` query, mood from the
first `<p>` in body). If even that fails, sensible defaults are
applied. The UI will never crash on a partial artifact.

---

## 4. HTML requirements (per variant)

Each `html` string MUST be a self-contained HTML5 document. The
following are mandatory:

- **Doctype:** `<!DOCTYPE html>` at the top.
- **Charset:** `<meta charset="utf-8">` inside `<head>`.
- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Title:** A meaningful `<title>` per variant.
- **Google Fonts:** Use the standard pair of tags:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
  ```
  The family names in the `family=` query must match `meta.fontHeading`
  and `meta.fontBody`. The frontend uses them to display the fonts
  in the meta card.
- **Background:** body background should be `meta.primaryColor`.
- **Typography:** `<h1>`/`<h2>`/`<h3>` use `meta.fontHeading`; body
  text uses `meta.fontBody`.
- **Logo placeholder:** include a visible logo placeholder, e.g.:
  ```html
  <div style="border:2px dashed #94A3B8;display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:12px;color:#94A3B8;font-weight:600;letter-spacing:0.2em">LOGO</div>
  ```
- **Examples:** include 3-4 usage examples (hero with CTA, card with
  image+text, button styles, a footer or testimonial block).
- **No external scripts:** zero `<script src="...">` tags.
- **No external images:** only inline SVG, CSS gradients, or the
  `LOGO` text placeholder. Remote `<img>` tags are not allowed.
- **Size budget:** total HTML must be **< 50 KB** per variant so the
  iframe loads instantly.
- **Sandbox-safe:** the iframe has `sandbox="allow-same-origin"` and
  NO `allow-scripts` — anything requiring JS will be blocked.

### Example (minimal valid variant A)

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Estilo A — Moderno y vibrante</title>
    <meta name="mood" content="moderno, vibrante, profesional" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
    <style>
      :root { --primary:#0F172A; --secondary:#F59E0B; }
      body { margin:0; font-family:'Source Sans 3',sans-serif; background:var(--primary); color:#E2E8F0; }
      h1,h2,h3 { font-family:Inter,sans-serif; }
      .logo { display:inline-flex; align-items:center; justify-content:center; width:120px; height:120px; border:2px dashed #94A3B8; border-radius:12px; color:#94A3B8; font-weight:600; letter-spacing:0.2em; }
      .btn { background:var(--secondary); color:#0F172A; padding:0.75rem 1.5rem; border-radius:8px; font-weight:600; }
      .hero { padding:4rem 2rem; text-align:center; }
      .card { background:#1E293B; padding:1.5rem; border-radius:12px; margin:1rem auto; max-width:480px; }
    </style>
  </head>
  <body>
    <section class="hero">
      <div class="logo">LOGO</div>
      <h1 style="font-size:2.5rem;margin-top:1rem">Tu marca, tu estilo</h1>
      <p>Una identidad moderna que conecta con tu audiencia.</p>
      <button class="btn">Empezar</button>
    </section>
    <section class="card">
      <h2>Card de ejemplo</h2>
      <p>Tipografía, color y jerarquía trabajando juntos.</p>
    </section>
  </body>
</html>
```

---

## 5. How the user interacts with the result

The modal in `brew-validator` shows:

1. Tabs **A / B / C** at the top (with the variant `meta.name` on the tab).
2. An iframe that renders the active variant's `html` via `srcDoc`.
3. A meta card below with: palette swatches (primary + secondary hex),
   typography (heading + body family names), and the mood line.
4. Three actions:
   - **Usar este estilo** → POST `/substep/choose` with
     `choice: "A"|"B"|"C"` and `nextSubStep: "final"`. The phase
     advances to the brand book step.
   - **Iterar** → POST `/substep/iterate` with the same
     `subStep: "visual"` and free-text feedback. The agent receives
     the previous artifact and the feedback and emits a new set of
     A/B/C variants.
   - **Descargar HTML** → GET
     `/api/projects/[id]/phases/[phaseId]/substep/visual-download?variant=A|B|C`.
     The endpoint streams the raw HTML of the active variant as
     `attachment; filename="style-guide-{variant}.html"`.

---

## 6. What NOT to do

- **Don't** put the A/B/C variants in the top-level `options` field
  of `subStepArtifact`. That field has a different shape
  (`{ value, label }[]`) used by other sub-steps. The visual variants
  live inside `content.options`.
- **Don't** emit more than 3 variants. The modal always shows 3 tabs.
- **Don't** use `null` for `meta` fields — the parser falls back to
  HTML extraction, which is fragile. Always provide explicit meta.
- **Don't** include external scripts or remote images in the variant
  HTML. The iframe is sandboxed without `allow-scripts` and `<img>`
  with remote URLs will be blocked by many CDNs.
- **Don't** exceed 50 KB per variant. Bigger payloads block the
  initial render.

---

## 7. Versioning

If the contract changes, bump the parser in
`src/lib/identity-visual.ts` (`parseVisualArtifactContent`) to accept
the new shape and keep the old one as a fallback during a transition
window. Notify `@arquity` so the modal can be updated in lockstep.
