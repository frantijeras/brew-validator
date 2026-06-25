import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderMarkdown } from "@/components/markdown-renderer";
import { TERMS_MARKDOWN, TERMS_VERSION } from "@/lib/terms";
import { ConsentButton } from "./consent-button";

export default async function ConsentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { termsAcceptedAt: true, termsVersion: true },
  });

  // Si ya aceptó la versión vigente, no hay nada que consentir.
  if (user?.termsAcceptedAt && user.termsVersion === TERMS_VERSION) {
    redirect("/ideas");
  }

  const html = renderMarkdown(TERMS_MARKDOWN, undefined, true);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Antes de empezar
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Para usar BrewIdea necesitas leer y aceptar los términos de esta demo.
          </p>
        </div>

        <article
          className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-6 md:p-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <ConsentButton />

        <p className="text-center text-xs text-slate-500">
          Versión {TERMS_VERSION}
        </p>
      </div>
    </div>
  );
}
