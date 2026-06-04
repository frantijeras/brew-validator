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
        <div className="flex flex-col items-center gap-4">
          <svg
            className="size-20 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4 C6 -1, 18 -1, 18 4" />
            <path d="M4.5 5.5 L6 17 C6.6 20, 9 22, 12 22 C15 22, 17.4 20, 18 17 L19.5 5.5" />
            <path d="M4 5.5 C4 6.5, 20 6.5, 20 5.5" strokeWidth="2" />
            <circle cx="9" cy="10" r="1.2" />
            <circle cx="14" cy="12" r="0.9" />
            <circle cx="11" cy="14" r="1" />
          </svg>
          <h1 className="text-3xl font-bold tracking-tight text-white">BrewIA</h1>
        </div>

        {/* Login form */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
