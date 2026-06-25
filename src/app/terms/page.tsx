import Link from "next/link";
import type { Metadata } from "next";
import { renderMarkdown } from "@/components/markdown-renderer";
import { TERMS_MARKDOWN, TERMS_VERSION, CREATOR } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Términos y condiciones — BrewIdea",
  description: "Términos de uso de la demo BrewIdea",
};

export default function TermsPage() {
  const html = renderMarkdown(TERMS_MARKDOWN, undefined, true);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-amber-400 transition-colors hover:text-amber-300"
          >
            ← Volver
          </Link>
          <span className="text-xs text-slate-500">
            Versión {TERMS_VERSION}
          </span>
        </div>

        <article
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 md:p-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <p className="mt-8 text-center text-xs text-slate-500">
          © {CREATOR} · Versión {TERMS_VERSION}
        </p>
      </div>
    </div>
  );
}
