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
            <path d="M7 3 C5 -3, 19 -3, 17 3" />
            <path d="M4 6 L5.5 17 C6.5 19.5, 17.5 19.5, 18.5 17 L20 6" />
            <path d="M3.5 6 C3.5 8, 20.5 8, 20.5 6" strokeWidth="2.2" />
            <line x1="7.5" y1="18" x2="7" y2="22" />
            <line x1="12" y1="18.5" x2="12" y2="22" />
            <line x1="16.5" y1="18" x2="17" y2="22" />
            <circle cx="9" cy="11" r="1" />
            <circle cx="13" cy="12.5" r="0.8" />
            <circle cx="11" cy="14" r="0.7" />
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
