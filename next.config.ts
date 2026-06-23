import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor autocontenido en .next/standalone para la imagen Docker
  // del VPS (no afecta al desarrollo ni al despliegue en Vercel).
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Reactividad: que el Router Cache de cliente NO sirva páginas dinámicas
    // viejas al navegar. Con dynamic:0 cada navegación a una ruta dinámica
    // (ideas, proyectos, validación…) trae datos frescos del servidor, así la
    // UI refleja al instante lo recién creado/cambiado en vez de quedarse
    // congelada hasta una recarga manual.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
