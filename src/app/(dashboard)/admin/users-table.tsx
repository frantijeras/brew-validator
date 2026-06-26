"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Plan = "gratis" | "estandar" | "premium";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  status: "active" | "suspended";
  createdAt: string;
  invitedAt: string | null;
  plan: Plan;
  maxIdeas: number;
  maxProjects: number;
  phaseUndosAllowed: number;
  canAccessSkills: boolean;
  canAccessHandoff: boolean;
  ideasCount: number;
  projectsCount: number;
  ideasCreated: number;
  projectsCreated: number;
  totalCost: number;
  lastActivity: string | null;
}

const PLAN_LABELS: Record<Plan, string> = {
  gratis: "Gratis",
  estandar: "Estándar",
  premium: "Premium",
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function initialsOf(name: string | null, email: string) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email.charAt(0).toUpperCase();
}

export function UsersTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("No autorizado");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Usuarios</h2>
          <p className="mt-1 text-sm text-slate-400">
            Gestiona límites, permisos y estado de cada cuenta
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={load}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabla (desktop) */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 text-right font-medium">Ideas</th>
              <th className="px-3 py-2 text-right font-medium">Proyectos</th>
              <th className="px-3 py-2 text-right font-medium">Coste IA</th>
              <th className="px-3 py-2 font-medium">Últ. actividad</th>
              <th className="px-3 py-2 font-medium">Permisos</th>
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  No hay usuarios
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-slate-800/60 align-middle hover:bg-slate-800/20"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                      {initialsOf(u.name, u.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium text-white">
                        {u.name ?? "Sin nombre"}
                        {u.isAdmin && (
                          <ShieldCheck
                            className="size-3.5 shrink-0 text-amber-400"
                            aria-label="Administrador"
                          />
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {u.status === "active" ? "Activo" : "Suspendido"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-300">
                    {PLAN_LABELS[u.plan] ?? u.plan}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                  {u.ideasCreated}
                  <span className="text-slate-600"> / {u.maxIdeas}</span>
                </td>
                <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                  {u.projectsCreated}
                  <span className="text-slate-600"> / {u.maxProjects}</span>
                </td>
                <td className="px-3 py-3 text-right text-slate-300">
                  {fmtCost(u.totalCost)}
                </td>
                <td className="px-3 py-3 text-slate-400">
                  {fmtDate(u.lastActivity)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.canAccessSkills && (
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300">
                        Skills
                      </span>
                    )}
                    {u.canAccessHandoff && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                        Handoff
                      </span>
                    )}
                    {!u.canAccessSkills && !u.canAccessHandoff && (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(u)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
            );
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/* ── Modal de edición ── */

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={inputClass}
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-amber-500" : "bg-slate-700"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [maxIdeas, setMaxIdeas] = useState(user.maxIdeas);
  const [maxProjects, setMaxProjects] = useState(user.maxProjects);
  const [phaseUndosAllowed, setPhaseUndos] = useState(user.phaseUndosAllowed);
  const [canAccessSkills, setSkills] = useState(user.canAccessSkills);
  const [canAccessHandoff, setHandoff] = useState(user.canAccessHandoff);
  const [suspended, setSuspended] = useState(user.status === "suspended");
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [pending, setPending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          maxIdeas,
          maxProjects,
          phaseUndosAllowed,
          canAccessSkills,
          canAccessHandoff,
          status: suspended ? "suspended" : "active",
          isAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        setPending(false);
        return;
      }
      onSaved(data.user as AdminUser);
    } catch {
      setError("Error de red al guardar");
      setPending(false);
    }
  }

  async function handleResetUsage() {
    if (
      !window.confirm(
        "¿Resetear el uso (ideas y proyectos creados) de este usuario? El recuento vuelve a cero."
      )
    ) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetUsage: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo resetear el uso");
        setResetting(false);
        return;
      }
      onSaved(data.user as AdminUser);
    } catch {
      setError("Error de red al resetear el uso");
      setResetting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar: ${user.name ?? user.email}`}
      tall
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" loading={pending} onClick={handleSave}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Plan
          </p>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className={inputClass}
          >
            <option value="gratis">Gratis</option>
            <option value="estandar">Estándar</option>
            <option value="premium">Premium</option>
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            El plan define qué modelos de IA usa este usuario.
          </p>
        </div>

        {isAdmin && (
          <p className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
            Los administradores están{" "}
            <span className="text-amber-300">exentos de límites</span>: no se aplican
            cuotas, accesos ni undos. Solo el plan de IA y el estado/rol.
          </p>
        )}

        {!isAdmin && (
        <>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Uso (acumulado)
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={resetting}
              onClick={handleResetUsage}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
              Resetear uso
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
              <p className="text-xs text-slate-500">Ideas creadas</p>
              <p className="mt-0.5 font-medium text-white tabular-nums">
                {user.ideasCreated}
                <span className="text-slate-600"> / {maxIdeas}</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
              <p className="text-xs text-slate-500">Proyectos creados</p>
              <p className="mt-0.5 font-medium text-white tabular-nums">
                {user.projectsCreated}
                <span className="text-slate-600"> / {maxProjects}</span>
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Límites
          </p>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Máx. ideas" value={maxIdeas} onChange={setMaxIdeas} />
            <NumberField label="Máx. proyectos" value={maxProjects} onChange={setMaxProjects} />
            <NumberField
              label="Undos de fase"
              value={phaseUndosAllowed}
              onChange={setPhaseUndos}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Permisos
          </p>
          <div className="space-y-2">
            <Toggle
              label="Acceso a Skills"
              description="Puede generar y usar skills de proyecto"
              checked={canAccessSkills}
              onChange={setSkills}
            />
            <Toggle
              label="Acceso a Handoff"
              description="Puede exportar el handoff del proyecto"
              checked={canAccessHandoff}
              onChange={setHandoff}
            />
          </div>
        </div>
        </>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Estado y rol
          </p>
          <div className="space-y-2">
            <Toggle
              label="Suspender cuenta"
              description={
                isSelf
                  ? "No puedes suspender tu propia cuenta"
                  : "No podrá iniciar sesión ni acceder"
              }
              checked={suspended}
              disabled={isSelf}
              onChange={setSuspended}
            />
            <Toggle
              label="Administrador"
              description={
                isSelf
                  ? "No puedes quitarte tu propio rol de admin"
                  : "Acceso completo al panel de administración"
              }
              checked={isAdmin}
              disabled={isSelf}
              onChange={setIsAdmin}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
