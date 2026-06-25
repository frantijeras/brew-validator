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

  // Gate de consentimiento: los usuarios NO admin deben haber aceptado la
  // versión vigente de los términos. Los admin están exentos.
  if (!session.user.isAdmin) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { termsAcceptedAt: true, termsVersion: true },
    });

    const accepted =
      !!user?.termsAcceptedAt && user.termsVersion === TERMS_VERSION;

    if (!accepted) {
      redirect("/consent");
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
