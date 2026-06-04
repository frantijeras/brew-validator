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
            {/* Glass body */}
            <path d="M5.5 4.5 L18 4.5 L15.5 19.5 L8 19.5 L5.5 4.5" />
            {/* Handle */}
            <path d="M18 7.5 C20.5 7.5 21.5 8.5 21.5 10 L21.5 10.5 C21.5 12 20.5 13 18 13" />
            {/* Foam */}
            <path d="M5 5 C9 2 14.5 2 18.5 5" strokeWidth="2.5" />
            {/* Bubbles */}
            <circle cx="9.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="13" cy="10.5" r="0.7" fill="currentColor" stroke="none" />
            <circle cx="10" cy="13" r="0.6" fill="currentColor" stroke="none" />
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
