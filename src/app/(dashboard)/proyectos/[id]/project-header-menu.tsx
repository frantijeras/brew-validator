"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { KebabMenu } from "@/components/kebab-menu";
import { DeleteConfirmModal } from "@/components/delete-confirm-modal";

interface ProjectHeaderMenuProps {
  projectId: string;
  projectName: string;
}

export function ProjectHeaderMenu({ projectId, projectName }: ProjectHeaderMenuProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const res = await fetch("/api/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error al borrar");
    }
    // Avisar al sidebar (Recientes) para que se refresque sin recargar.
    window.dispatchEvent(new Event("project-changed"));
    router.push("/proyectos");
  }

  return (
    <>
      <KebabMenu
        ariaLabel="Menú del proyecto"
        items={[
          {
            label: "Eliminar proyecto",
            icon: <Trash2 className="size-3.5" />,
            danger: true,
            onClick: () => setShowDeleteModal(true),
          },
        ]}
      />

      <DeleteConfirmModal
        open={showDeleteModal}
        title="Borrar proyecto"
        itemName={projectName}
        confirmLabel="Borrar proyecto"
        description={
          <>
            Esto eliminará el proyecto y todas sus fases de forma permanente.
            <span className="block mt-1 text-slate-400">
              La idea original no se verá afectada.
            </span>
          </>
        }
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
