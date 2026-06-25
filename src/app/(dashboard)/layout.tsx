import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { TERMS_VERSION } from "@/lib/terms";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, termsAcceptedAt: true, termsVersion: true },
  });

  // Cuenta suspendida: cortar acceso al dashboard.
  if (user?.status === "suspended") {
    redirect("/suspended");
  }

  // Gate de consentimiento: los usuarios NO admin deben haber aceptado la
  // versión vigente de los términos. Los admin están exentos.
  if (!session.user.isAdmin) {
    const accepted =
      !!user?.termsAcceptedAt && user.termsVersion === TERMS_VERSION;

    if (!accepted) {
      redirect("/consent");
    }
  }

  return (
    <DashboardShell isAdmin={session.user.isAdmin}>{children}</DashboardShell>
  );
}
