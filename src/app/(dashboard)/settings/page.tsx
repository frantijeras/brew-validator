import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = session.user.isAdmin
    ? await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          image: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isAdmin: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Ajustes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      <SettingsForm user={currentUser} users={users} isAdmin={session.user.isAdmin} />
    </div>
  );
}
