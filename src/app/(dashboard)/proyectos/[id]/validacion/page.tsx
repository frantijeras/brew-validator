import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ValidationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { ideaId: true },
  });
  if (project?.ideaId) redirect(`/ideas/${project.ideaId}`);
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-center">
      <p className="text-muted-foreground">No hay validación disponible para este proyecto.</p>
    </div>
  );
}
