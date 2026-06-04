export const BUSINESS_MODELS = [
  { value: "SaaS", label: "SaaS", icon: "☁️", description: "Software como servicio, suscripción mensual", example: "Gestor de facturas online" },
  { value: "Marketplace", label: "Marketplace", icon: "🏪", description: "Plataforma que conecta oferta y demanda", example: "Wallapop, Airbnb" },
  { value: "E-commerce", label: "E-commerce", icon: "🛒", description: "Tienda online, venta directa de productos", example: "Tienda de zapatillas online" },
  { value: "App móvil", label: "App Móvil", icon: "📱", description: "Aplicación para dispositivos móviles", example: "App de entrenamiento personal" },
  { value: "Plataforma", label: "Plataforma", icon: "🌐", description: "Plataforma digital que ofrece un servicio", example: "Comparador de seguros" },
  { value: "Negocio local", label: "Negocio Local", icon: "📍", description: "Negocio físico con presencia online", example: "Panadería con pedidos online" },
  { value: "Servicios", label: "Servicios", icon: "💼", description: "Prestación de servicios profesionales", example: "Plataforma de consultoría freelance" },
  { value: "Contenido/Media", label: "Contenido/Media", icon: "📰", description: "Creación y distribución de contenido", example: "Newsletter de análisis tech" },
  { value: "Hardware/IoT", label: "Hardware/IoT", icon: "🔧", description: "Producto físico con conectividad", example: "Sensor inteligente para hogar" },
  { value: "API/Infra", label: "API/Infra", icon: "⚡", description: "Infraestructura tecnológica como producto", example: "API de pagos para developers" },
  { value: "Impacto social", label: "Impacto Social", icon: "🌱", description: "Negocio con propósito social o ambiental", example: "App de consumo responsable" },
] as const;

export type BusinessModel = (typeof BUSINESS_MODELS)[number]["value"];
