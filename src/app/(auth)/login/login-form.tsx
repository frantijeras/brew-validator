"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas");
      setLoading(false);
    } else {
      const callbackUrl = searchParams.get("callbackUrl") ?? "/ideas";
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-slate-300"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-slate-300"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
