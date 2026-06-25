"use client";

import { useState } from "react";
import { acceptTerms } from "./actions";

export function ConsentButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await acceptTerms();
    } catch (e) {
      // redirect() lanza internamente NEXT_REDIRECT; lo relanzamos.
      throw e;
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
    >
      {loading ? "Guardando..." : "Acepto y continuar"}
    </button>
  );
}
