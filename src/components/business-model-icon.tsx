import {
  Cloud,
  Store,
  ShoppingCart,
  Smartphone,
  Globe,
  MapPin,
  Briefcase,
  Newspaper,
  Wrench,
  Zap,
  Sprout,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  SaaS: Cloud,
  Marketplace: Store,
  "E-commerce": ShoppingCart,
  "App móvil": Smartphone,
  Plataforma: Globe,
  "Negocio local": MapPin,
  Servicios: Briefcase,
  "Contenido/Media": Newspaper,
  "Hardware/IoT": Wrench,
  "API/Infra": Zap,
  "Impacto social": Sprout,
};

export function BusinessModelIcon({
  model,
  className = "size-4",
}: {
  model: string;
  className?: string;
}) {
  const Icon = iconMap[model];
  if (!Icon) return null;
  return <Icon className={className} />;
}
