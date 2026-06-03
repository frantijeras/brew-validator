import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const generateIdeaSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
  }),
  z.object({
    mode: z.literal("custom"),
    sector: z.string().min(3, "El sector debe tener al menos 3 caracteres"),
    targetUser: z.string().optional(),
    hints: z.string().optional(),
  }),
]);

// ── Random idea templates ──

const randomTemplates = [
  {
    title: "TrendPulse",
    description:
      "Panel de tendencias de mercado automatizado para equipos pequeños. Analiza redes sociales, noticias y datos públicos para ofrecer inteligencia de mercado accesible y procesable sin necesidad de un equipo de analistas.",
    targetUser: "Freelancers y equipos pequeños (1-10 personas) que necesitan inteligencia de mercado sin grandes presupuestos.",
    monetization: "SaaS desde 19 €/mes (plan básico para 3 industrias). Plan pro a 49 €/mes con datos en tiempo real.",
    score: 8,
  },
  {
    title: "SkillForge",
    description:
      "Plataforma de micro-learning que conecta profesionales senior con junior mediante proyectos prácticos de corta duración. Los seniors definen desafíos reales y los juniors aprenden resolviéndolos con feedback directo.",
    targetUser: "Profesionales en transición de carrera y estudiantes de bootcamps que quieren experiencia práctica real.",
    monetization: "Suscripción mensual de 29 € para juniors. Los seniors ganan comisiones por desafío completado (70/30 split).",
    score: 9,
  },
  {
    title: "GreenTrace",
    description:
      "Herramienta SaaS que calcula y certifica la huella de carbono de productos digitales. Se integra con pipelines de CI/CD y proveedores cloud para medir el impacto ambiental real de cada deploy.",
    targetUser: "Empresas tech medianas y startups que necesitan informes ESG y certificaciones de sostenibilidad para inversores y clientes B2B.",
    monetization: "SaaS desde 49 €/mes por proyecto. Enterprise desde 199 €/mes con API y white-label.",
    score: 7,
  },
  {
    title: "LocalBite",
    description:
      "Marketplace hiperlocal que conecta cocineros caseros con vecinos. Comida casera de calidad entregada a pie o en bici. Cada cocinero tiene su perfil verificado con fotos reales y valoraciones del barrio.",
    targetUser: "Cocineros caseros y foodies urbanos en barrios densos. Ideal para personas que quieren monetizar su pasión por la cocina.",
    monetization: "Comisión del 12 % por pedido. Suscripción premium a 9 €/mes para cocineros (sin comisión extra).",
    score: 8,
  },
  {
    title: "DocuFlow",
    description:
      "Automatización de procesos documentales con IA para pymes. Digitaliza, clasifica y extrae datos de facturas, contratos y formularios. Se integra con ERPs populares y gestorías online.",
    targetUser: "Pymes y autónomos que aún gestionan documentos en papel o PDFs desestructurados. Gestorías y asesorías que quieren automatizar la captura de datos.",
    monetization: "SaaS desde 39 €/mes (500 documentos/mes). Plan business a 99 € con workflows personalizados.",
    score: 8,
  },
  {
    title: "MindGarden",
    description:
      "App de bienestar mental que combina journaling guiado, meditaciones breves y terapia cognitivo-conductual gamificada. Usa patrones de escritura para detectar señales tempranas de ansiedad o burnout.",
    targetUser: "Profesionales de oficina y remotos entre 25-45 años con altos niveles de estrés. Empresas que quieren ofrecer bienestar mental como beneficio laboral.",
    monetization: "Freemium con suscripción Premium a 7 €/mes. Plan B2B desde 5 €/empleado/mes.",
    score: 9,
  },
  {
    title: "RentCheck",
    description:
      "Plataforma de verificación de inquilinos para propietarios particulares. Análisis de riesgo crediticio, historial de alquiler y verificación de empleo en menos de 24 horas. Incluye seguro de impago integrado.",
    targetUser: "Pequeños propietarios con 1-5 viviendas en alquiler que no tienen acceso a herramientas profesionales de screening.",
    monetization: "Pago por consulta: 19 € por verificación completa. Suscripción a 29 €/mes para propietarios con múltiples viviendas.",
    score: 7,
  },
  {
    title: "EventCraft",
    description:
      "Organizador de eventos corporativos con IA que sugiere venues, catering y actividades basándose en presupuesto, número de asistentes y objetivos del evento. Incluye gestión de invitaciones y seguimiento post-evento.",
    targetUser: "Departamentos de RRHH y operaciones de empresas medianas que organizan eventos trimestrales sin agencia externa.",
    monetization: "Comisión del 8 % sobre servicios reservados. Plan gratuito limitado, Pro a 19 €/mes.",
    score: 8,
  },
  {
    title: "PetConnect",
    description:
      "Red social y marketplace para dueños de mascotas. Perfiles para mascotas, matchmaking para adopciones, reserva de cuidadores verificados, y tienda con recomendaciones personalizadas por raza y edad.",
    targetUser: "Dueños de mascotas urbanos entre 20-40 años. Cuidadores profesionales de mascotas que buscan visibilidad.",
    monetization: "Freemium con funciones sociales gratis. Premium a 5 €/mes. Comisión del 15 % en servicios de cuidado.",
    score: 7,
  },
  {
    title: "CodeReviewBot",
    description:
      "Bot de revisión de código que se integra con GitHub y GitLab. Detecta bugs comunes, vulnerabilidades de seguridad, problemas de rendimiento y malas prácticas específicas del lenguaje. Explica el porqué y sugiere la corrección.",
    targetUser: "Equipos de desarrollo de startups y scale-ups que no tienen tiempo para revisiones manuales exhaustivas. Ideal para equipos con mezcla de seniors y juniors.",
    monetization: "SaaS desde 19 €/mes (repositorio único). Plan team a 79 €/mes con reglas personalizables.",
    score: 8,
  },
  {
    title: "TravelTwin",
    description:
      "App de viajes que empareja viajeros con gustos y presupuestos similares para compartir experiencias. Usa IA para recomendar itinerarios, alojamientos y actividades basándose en preferencias reales, no en anuncios patrocinados.",
    targetUser: "Viajeros solos entre 25-45 años que quieren compartir experiencias sin comprometerse a viajar con desconocidos todo el tiempo.",
    monetization: "Freemium con matching ilimitado en Premium (5 €/mes). Comisión sobre reservas de actividades grupales.",
    score: 8,
  },
  {
    title: "FarmDirect",
    description:
      "Plataforma que conecta productores agrícolas locales directamente con restaurantes y tiendas de barrio. Elimina intermediarios y reduce el desperdicio alimentario con pedidos bajo demanda y logística optimizada por IA.",
    targetUser: "Pequeños agricultores y productores artesanales. Restaurantes independientes que valoran producto local de calidad.",
    monetization: "Comisión del 10 % por transacción. Suscripción premium para productores con analytics y forecasting a 25 €/mes.",
    score: 8,
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function generateFromSector(data: {
  sector: string;
  targetUser?: string;
  hints?: string;
}): (typeof randomTemplates)[number] {
  const sectorClean = data.sector.trim();
  const sectorCapitalized = capitalizeWords(sectorClean);
  const sectorOneWord = sectorClean.split(/\s+/)[0];

  const targetUser =
    data.targetUser?.trim() ||
    `Emprendedores y profesionales del sector ${sectorClean}`;
  const hints = data.hints?.trim();

  const hintsSuffix = hints ? ` con foco en ${hints}` : "";

  const titles = [
    `${sectorCapitalized}Hub`,
    `${sectorCapitalized}Pro`,
    `${sectorOneWord}Flow`,
    `${sectorOneWord}Connect`,
    `${sectorOneWord}Smart`,
  ];

  const title = pickRandom(titles);

  return {
    title,
    description: `Plataforma integral que centraliza servicios, información y herramientas para profesionales del sector ${sectorClean}${hintsSuffix}. Conecta oferta y demanda, automatiza procesos y ofrece datos de mercado en tiempo real para tomar mejores decisiones.`,
    targetUser,
    monetization: "SaaS con planes desde 19 €/mes. Funcionalidades premium y API para integraciones empresariales.",
    score: 7,
  };
}

// ── POST ──

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = generateIdeaSchema.parse(body);

    let ideaData: {
      title: string;
      description: string;
      targetUser: string;
      monetization: string;
      score: number;
      status: string;
    };

    if (data.mode === "random") {
      const template = pickRandom(randomTemplates);
      ideaData = { ...template, status: "DRAFT" };
    } else {
      const template = generateFromSector(data);
      ideaData = { ...template, status: "DRAFT" };
    }

    const idea = await prisma.idea.create({
      data: {
        ...ideaData,
        originalIdea: ideaData.description,
      },
    });

    return NextResponse.json(
      { success: true, ideaId: idea.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/generate]", error);
    return NextResponse.json(
      { error: "Error al generar la idea" },
      { status: 500 }
    );
  }
}
