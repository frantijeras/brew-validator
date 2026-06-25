import Link from "next/link";
import { prisma } from "@/lib/db";
import { InviteForm } from "./invite-form";
import { Footer } from "@/components/footer";

function Logo() {
  return (
    <svg
      className="size-20 text-amber-400"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 7 L17 12 L21 13 L17 14 L16 18 L15 14 L11 13 L15 12 Z" />
      <path d="M6 21 L7 24 L10 25 L7 26 L6 29 L5 26 L2 25 L5 24 Z" transform="translate(2,0)" />
      <path d="M26 21 L27 24 L30 25 L27 26 L26 29 L25 26 L22 25 L25 24 Z" transform="translate(-2,0)" />
    </svg>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  const isValid =
    invitation &&
    invitation.status === "PENDING" &&
    invitation.expiresAt >= new Date();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <h1 className="text-3xl font-bold tracking-tight text-white">BrewIdea</h1>
        </div>

        {isValid ? (
          <>
            <p className="text-center text-sm text-slate-400">
              Has sido invitado/a. Crea tu cuenta para empezar.
            </p>
            <InviteForm token={token} email={invitation.email} />
            <p className="text-center text-sm text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-amber-400 hover:text-amber-300">
                Inicia sesión
              </Link>
            </p>
          </>
        ) : (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              Invitación inválida o caducada.
            </div>
            <p className="text-sm text-slate-400">
              Pide al administrador una nueva invitación o{" "}
              <Link href="/login" className="text-amber-400 hover:text-amber-300">
                inicia sesión
              </Link>{" "}
              si ya tienes cuenta.
            </p>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
