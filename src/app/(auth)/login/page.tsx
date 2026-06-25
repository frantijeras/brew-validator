import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Footer } from "@/components/footer";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/ideas");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <svg
            className="size-24 text-amber-400"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 7 L17 12 L21 13 L17 14 L16 18 L15 14 L11 13 L15 12 Z" />
            <path
              d="M6 21 L7 24 L10 25 L7 26 L6 29 L5 26 L2 25 L5 24 Z"
              transform="translate(2,0)"
            />
            <path
              d="M26 21 L27 24 L30 25 L27 26 L26 29 L25 26 L22 25 L25 24 Z"
              transform="translate(-2,0)"
            />
          </svg>
          <h1 className="text-3xl font-bold tracking-tight text-white">BrewIdea</h1>
        </div>

        {/* Login form */}
        <Suspense>
          <LoginForm />
        </Suspense>

        <Footer />
      </div>
    </div>
  );
}
