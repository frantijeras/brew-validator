"use client";

import { useState } from "react";
import { acceptTerms } from "./actions";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="primary"
      fullWidth
      loading={loading}
      onClick={handleClick}
      className="py-3"
    >
      {loading ? "Guardando..." : "Acepto y continuar"}
    </Button>
  );
}
