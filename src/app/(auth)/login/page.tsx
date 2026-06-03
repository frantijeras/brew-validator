import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/ideas");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <svg
            className="size-16 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
            <path d="M9 12v6" />
            <path d="M13 12v6" />
            <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
            <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
          </svg>
          <h1 className="text-2xl font-bold tracking-tight text-white">Brew</h1>
          <p className="text-sm text-slate-400">Validador de ideas</p>
        </div>

        {/* Login form */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
