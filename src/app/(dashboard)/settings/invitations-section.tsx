"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

interface Invitation {
  id: string;
  email: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl: string | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

const STATUS_META: Record<InviteStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-amber-500/10 text-amber-400",
  },
  ACCEPTED: {
    label: "Aceptada",
    className: "bg-emerald-500/10 text-emerald-400",
  },
  REVOKED: {
    label: "Revocada",
    className: "bg-slate-600/30 text-slate-400",
  },
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(inv: Invitation): boolean {
  return inv.status === "PENDING" && new Date(inv.expiresAt).getTime() < Date.now();
}

/* ── Botón de copiar enlace reutilizable ── */
function CopyLinkButton({ url, label = "Copiar enlace" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignorar
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} title={url}>
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function InvitationsSection() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { inviteUrl: string; emailSent: boolean; emailError?: string } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      // ignorar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la invitación");
      } else {
        setResult({
          inviteUrl: data.inviteUrl,
          emailSent: data.emailSent,
          emailError: data.emailError,
        });
        setEmail("");
        await load();
      }
    } catch {
      setError("Error de red al crear la invitación");
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/invitations/${id}/revoke`, { method: "POST" });
      if (res.ok) await load();
    } catch {
      // ignorar
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Invitaciones</h2>
          <p className="mt-1 text-sm text-slate-400">
            Invita por email a nuevas personas a esta demo privada
          </p>
        </div>
      </div>

      {/* Formulario de nueva invitación */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="inviteEmail" className="mb-1 block text-xs font-medium text-slate-400">
            Email de la persona invitada
          </label>
          <input
            id="inviteEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="persona@email.com"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="primary" loading={pending} className="shrink-0">
          {!pending && <Mail className="h-4 w-4" />}
          {pending ? "Enviando..." : "Enviar invitación"}
        </Button>
      </form>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Resultado: enlace para copiar + estado del email */}
      {result && (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-300">
            {result.emailSent
              ? "Invitación enviada por email."
              : "Invitación creada. No se pudo enviar el email — copia el enlace y compártelo manualmente."}
          </p>
          {!result.emailSent && result.emailError && (
            <p className="mt-1 text-xs text-slate-400">Motivo: {result.emailError}</p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-amber-300">
              {result.inviteUrl}
            </code>
            <CopyLinkButton url={result.inviteUrl} />
          </div>
        </div>
      )}

      {/* Lista de invitaciones */}
      <div className="mt-6 space-y-2">
        {loading && <p className="py-4 text-center text-sm text-slate-500">Cargando...</p>}

        {!loading && invitations.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            Todavía no has enviado ninguna invitación
          </p>
        )}

        {invitations.map((inv) => {
          const expired = isExpired(inv);
          const meta = STATUS_META[inv.status];
          return (
            <div
              key={inv.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{inv.email}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                  {expired && (
                    <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                      Caducada
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Enviada {fmtDate(inv.createdAt)} · Caduca {fmtDate(inv.expiresAt)}
                  {inv.acceptedAt ? ` · Aceptada ${fmtDate(inv.acceptedAt)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {inv.status === "PENDING" && inv.inviteUrl && (
                  <CopyLinkButton url={inv.inviteUrl} />
                )}
                {inv.status === "PENDING" && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRevoke(inv.id)}
                  >
                    <X className="h-4 w-4" />
                    Revocar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
