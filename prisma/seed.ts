import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ideas = [
  {
    title: "MeetScribe",
    description: "Asistente IA para reuniones que transcribe, resume y asigna tareas automáticamente. Ahorra 5h/semana a equipos que tienen muchas reuniones.",
    targetUser: "Equipos remotos de 5-50 personas con >10 reuniones semanales",
    monetization: "SaaS freemium: gratis 10 reuniones/mes, Pro 29€/mes ilimitado",
  },
  {
    title: "Emotion Stories AI",
    description: "App que genera cuentos personalizados con IA para ayudar a niños (3-10 años) a procesar emociones difíciles como divorcio, mudanza, pérdida de una mascota.",
    targetUser: "Padres de niños 3-10 años que atraviesan cambios emocionales importantes",
    monetization: "Suscripción 9.99€/mes, packs temáticos 4.99€",
  },
  {
    title: "TrendPulse",
    description: "Panel de tendencias de mercado automatizado para equipos pequeños. Analiza redes, noticias y datos para dar inteligencia de mercado accesible.",
    targetUser: "Freelance y equipos pequeños (1-10 pers) que necesitan inteligencia de mercado",
    monetization: "SaaS desde 19€/mes (plan básico de 3 industrias)",
  },
];

async function main() {
  console.log("🌱 Seeding...");

  for (const idea of ideas) {
    const existing = await prisma.idea.findFirst({
      where: { title: idea.title },
    });

    if (!existing) {
      await prisma.idea.create({ data: idea });
      console.log(`  Created: ${idea.title}`);
    } else {
      console.log(`  Skipped: ${idea.title} (already exists)`);
    }
  }

  console.log("✅ Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
