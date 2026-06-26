# Revisión completa — brewIdea (2026-06-26)

Auditoría multi-agente (6 streams, solo lectura): flujo/estados, seguridad/multiusuario, robustez del bridge, correctitud, código muerto y UI/UX+producto. Severidad 🔴 crítico · 🟡 medio · 🟢 menor. Marcado **[ARREGLADO]** lo ya corregido en commit `00147a2`.

---

## 🔴 Críticos

1. **[ARREGLADO] `idea-refiner`/`idea-improver` no se despachaban** — `api/jobs/pending` los filtraba en BD (whitelist `MONITORED_AGENTS`). "Refinar idea" y "Mejorar idea" no se ejecutaban y dejaban la idea colgada en `REFINING`/`IMPROVING`. → añadidos a la whitelist.
2. **[ARREGLADO] Reaper no cubría refiner/improver ni `IMPROVING`** — una idea colgada en esos estados no se autocuraba. → añadidos a `IDEA_AGENTS` + estado `IMPROVING`; al desatascar vuelve a `COMPLETED` si estaba validada (no la degrada a `DRAFT`).
3. **[ARREGLADO] Cancelar validación se "resucitaba"** — el claim atómico del webhook no incluía `CANCELLED`; un callback tardío recreaba el report y marcaba la idea `DONE`. → `notIn` incluye `CANCELLED`.
4. **[ARREGLADO] `/api/bridge/heartbeat` sin auth** — cualquiera podía falsear el estado del bridge. → exige `BRIDGE_SECRET`.

### 🔴 Pendientes (recomiendo arreglar ya)
5. **Usuario suspendido / sin consentimiento sigue operando vía API.** La suspensión y el consentimiento solo se aplican en el login y en el render del layout; el JWT no lleva `status` y `requireAuth`/guards no reconsultan la BD. Un suspendido con sesión viva puede llamar a toda la API directamente. → reconsultar `status` (y consentimiento para no-admin) en `requireAuth` o bloquear mutaciones si `suspended`. *(security)*
6. **Código muerto en el bridge** (`bridge.py`): `process_idea_renamer`, `process_qa_refiner` + `process_quiz/manual/chat_mode` son funciones huérfanas sin call-site; `project-dev`/`project-dossier` mapeados sin skill. → borrar. *(cleanliness)*

---

## 🟡 Medios

**Seguridad / integridad**
7. **`POST /api/ideas` saltaba la cuota** **[ARREGLADO]** (ahora aplica `maxIdeas`).
8. **`execute-phase` no cruzaba fase↔proyecto** **[ARREGLADO]** (`findFirst {id, projectId}`).
9. **Validación no consume cuota** — re-validar (3 jobs IA) es ilimitado y gratis: la mayor fuga de coste. → decidir si limitarla (cuota propia o contar como refinado).
10. **Cuotas con ventana TOCTOU** — `assertCan*` + `increment*` no atómicos; 2 peticiones simultáneas pueden superar la cuota en +1. → incremento condicional atómico (`updateMany where counter < max`).
11. **`project-phase-callback` sin claim atómico** — idempotencia read-then-write; 2 callbacks concurrentes podrían duplicar el cierre de fase / decisiones en `Project.memory`. → mismo patrón de claim que `agent-callback`.
12. **`cancel-phase` por substring + sin scope de proyecto** — filtra jobs con `input contains phaseId`; podría cancelar jobs ajenos. → parsear input y comparar `phaseId` exacto + acotar por `ideaId`.
13. **Resolución de config de modelos ignora `userId`** — lecturas `findFirst({where:{key}})` sin usuario; con >1 admin la config de modelos sería no determinista. (Hoy 1 admin → no se manifiesta.) → fila de config canónica.
14. **Bridge: validación hace `break` al primer fallo** — deja `advocate`/`judge` PENDING hasta que el reaper los corte (10 min). → marcar FAILED los hermanos.
15. **Bridge: ignora el 409 del claim RUNNING** — si hubiera 2 bridges, doble ejecución del CLI (coste duplicado). → abortar si el POST RUNNING devuelve 409.

**Correctitud menor**
16. `FAILED` del improver no reseteaba con input ilegible **[ARREGLADO]**. `cost` rechazaba 0 **[ARREGLADO]**.
17. **La página de idea no hace polling en `GENERATING`** — si recargas durante la generación, no ves la transición sin recargar a mano. → añadir `GENERATING`/`VALIDATING` al polling.
18. `PROJECT_AGENTS` incompleto (faltan branding/business) e `isProjectAgent` daría falso (no se usa hoy). PATCH de idea no admite `IMPROVING` en su enum. *(menores)*

---

## 🟢 UI/UX + Producto (mejoras)

**Adopción del design system (deuda estructural — el sistema existe pero apenas se usa):**
- ~24 botones ámbar reimplementados inline en vez de `<Button>`; 2 objetos `btnStyles`/`buttonStyles` que duplican variantes; **6 overlays `fixed inset-0` a mano** en vez de `<Modal>`; `<Card>` importado en 1 sitio (superficie duplicada en 31); 3 `inputClass` duplicados (sin primitivo `Input`); `toast` (accesible, con cola) usado en 1 solo sitio; `focus:ring` en vez de `focus-visible` (29 inputs); tabs con 2 estilos distintos; confirmaciones destructivas dispares (`window.confirm` vs `Modal` vs sin confirmar).

**Producto (para gestionar la demo y hacerla más profesional):**
- **/admin:** falta **coste por usuario** (el dato ya se agrega), **funnel de conversión** (idea→validación→proyecto→fases→hand-off), tope de coste y gestión de solicitudes con motivo+nota+notificación.
- **Feedback de cola del bridge secuencial:** al lanzar una fase se muestra "Procesando" aunque esté en cola; devolver posición/espera estimada ("en cola, posición 2 · ~5 min") es la mayor palanca de velocidad percibida.
- **Campana de notificaciones:** la API `notifications` existe pero **no hay UI que la consuma** (avisar de fase terminada / solicitud resuelta).
- **Onboarding y descubribilidad:** empty states guiados (CREAR→VALIDAR→REFINAR/MEJORAR), tooltips de Refinar/Mejorar, claridad de los límites de la demo en consent.
- **Hand-off:** mostrar progreso de requisito ("3/5 fases") en el tab bloqueado.
- **Tablas admin** no responsive (solo scroll-x en móvil).

---

## 🟢 Limpieza / deuda

- **Flujo de migraciones incoherente:** `prisma/migrations/` (15, sin `migration_lock.toml`, declaradas rotas en el README) coexiste con `db push`. → decidir uno; lo coherente es **borrar `migrations/`** y documentar `db push`.
- **Enum `POLISHING` muerto** (nunca se asigna; residuo del refiner retirado) → eliminar del enum y de labels/listas.
- **`project-branding` legacy** mapeado en 4 sitios como "fallback" pero nunca encolado (IDENTITY usa 4 sub-skills) → eliminar o documentar.
- **Listas de agentes y `DEFAULT_MODELS` duplicados (4 copias)** entre `agent-models.ts`, la route de settings, `MONITORED_AGENTS` y `PROJECT_AGENTS`, ya desincronizadas → centralizar en un módulo.
- **`addUser`** server action huérfana (el alta va por invitaciones) → borrar.
- **Artefactos:** `.vercel/` (ya no se usa Vercel), `__pycache__/*.pyc` versionado, `docs/skills-vps-backup/` (6 snapshots), `skills/README.md` desfasado (documenta 5 skills de 15).

---

## Lo que está BIEN (verificado, para no perseguir fantasmas)
Aislamiento por dueño sistemático en casi todas las rutas; gating admin server-side correcto; invitaciones con token fuerte/expiry/single-use; secretos no expuestos al cliente (apiKey, tokens); claims atómicos + advisory lock en `agent-callback`; rollbacks atómicos y scoped; `nonBusyStatus`/`pickRefinedFields` correctos; sistema de modales de 3 capas intencional; hooks de polling sin reimplementaciones.

---

### Prioridad sugerida
1. **🔴 #5** (suspendido/consentimiento vía API) — único agujero de privilegio que queda.
2. **🟡 #10/#11/#12** (TOCTOU cuota, claim atómico de fases, cancel-phase exacto) — integridad/coste.
3. **🔴 #6 + limpieza del bridge** y **centralizar listas de agentes** (#13/duplicados) — evita futuros bugs como el #1.
4. **#9** decidir política de coste de validación.
5. **UI/UX:** adopción del design system + feedback de cola + /admin (coste por usuario, funnel) — alto impacto en profesionalidad.
6. Resto de limpieza (migraciones, POLISHING, .vercel, etc.).
