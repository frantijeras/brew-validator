"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DemoLimitDialog } from "@/components/demo-limit-dialog";
import { Button } from "@/components/ui/button";

/**
 * Botón "Nueva idea" con gate de demo. Cuando el usuario ha alcanzado su límite
 * de ideas (`limitReached`), en lugar de un span deshabilitado muestra un botón
 * que abre el DemoLimitDialog para solicitar una ampliación al administrador.
 *
 * Es un Client Component porque page.tsx (Server Component) no puede gestionar
 * el estado del diálogo.
 */
export function NewIdeaGate({
  limitReached,
  maxIdeas,
}: {
  limitReached: boolean;
  maxIdeas?: number;
}) {
  const [open, setOpen] = useState(false);

  if (!limitReached) {
    return (
      <Link
        href="/ideas/new"
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-colors hover:bg-amber-400 active:bg-amber-600"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Nueva idea
      </Link>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={() => setOpen(true)}
        title={
          maxIdeas != null
            ? `Has alcanzado el máximo de ${maxIdeas} ideas. Solicita más al administrador.`
            : "Has alcanzado el máximo de ideas. Solicita más al administrador."
        }
        className="px-4 py-2.5 shadow"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Nueva idea
      </Button>
      <DemoLimitDialog
        open={open}
        onClose={() => setOpen(false)}
        type="ideas"
        message="Has alcanzado el máximo de ideas de tu plan."
      />
    </>
  );
}
