export const BUSINESS_MODELS = [
  { value: "SaaS", label: "SaaS", icon: "☁️", description: "Software como servicio (suscripción)" },
  { value: "Marketplace", label: "Marketplace", icon: "🛒", description: "Conectar oferta y demanda" },
  { value: "E-commerce", label: "E-commerce", icon: "🛍️", description: "Venta directa de productos" },
  { value: "App móvil", label: "App móvil", icon: "📱", description: "App con monetización (ads, compras, premium)" },
  { value: "Plataforma", label: "Plataforma", icon: "🌐", description: "Red social, comunidad, contenido generado por usuarios" },
  { value: "Negocio local", label: "Negocio local", icon: "📍", description: "Tienda física, restaurante, servicios presenciales" },
  { value: "Servicios", label: "Servicios", icon: "💼", description: "Consultoría, asesoría, freelancer" },
  { value: "Contenido/Media", label: "Contenido/Media", icon: "📝", description: "Newsletter, podcast, cursos, suscripción a contenido" },
  { value: "Hardware/IoT", label: "Hardware/IoT", icon: "🔧", description: "Producto físico con conectividad" },
  { value: "API/Infra", label: "API/Infra", icon: "⚙️", description: "Vender acceso a datos, APIs, servicios backend" },
  { value: "Impacto social", label: "Impacto social", icon: "🌱", description: "ONG, economía circular, propósito social" },
] as const;

export type BusinessModel = (typeof BUSINESS_MODELS)[number]["value"];
