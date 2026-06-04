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
            className="size-24 text-amber-400"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 14 L25 14 L23 26 L9 26 Z" />
            <ellipse cx="16" cy="14" rx="9" ry="2" />
            <path d="M10 6 L10 10 M8 8 L12 8" />
            <path d="M22 6 L22 10 M20 8 L24 8" />
            <path d="M16 3 L16 6 M14 4.5 L18 4.5" />
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
