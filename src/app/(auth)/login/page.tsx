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
            {/* Cauldron body */}
            <path d="M6 12 L26 12 L24 26 Q23 28.5 16 28.5 Q9 28.5 8 26 Z" />
            {/* Cauldron rim */}
            <ellipse cx="16" cy="12" rx="10" ry="2.5" />
            {/* AI Star 4-point */}
            <path
              d="M16 16 L17.4 19.2 L21 20.5 L17.4 21.8 L16 25 L14.6 21.8 L11 20.5 L14.6 19.2 Z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <h1 className="text-3xl font-bold tracking-tight text-white">BrewIdea</h1>
        </div>

        {/* Login form */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
