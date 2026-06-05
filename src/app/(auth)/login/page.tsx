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
            {/* AI Star 4-point */}
            <path
              d="M16 1 L17.2 5 L21 6.5 L17.2 8 L16 12 L14.8 8 L11 6.5 L14.8 5 Z"
              fill="currentColor"
              stroke="none"
            />
            {/* Cauldron rim */}
            <ellipse cx="16" cy="15" rx="9" ry="2.5" />
            {/* Cauldron body */}
            <path d="M7 15 L25 15 L23 27 Q22 28.5 16 28.5 Q10 28.5 9 27 Z" />
            {/* Bubble left */}
            <circle cx="11" cy="20" r="1.2" fill="currentColor" fillOpacity="0.5" />
            {/* Bubble right */}
            <circle cx="19" cy="22" r="1" fill="currentColor" fillOpacity="0.5" />
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
