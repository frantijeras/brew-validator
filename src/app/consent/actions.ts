"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TERMS_VERSION } from "@/lib/terms";

export async function acceptTerms() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const hdrs = await headers();
  // IP del primer salto en x-forwarded-for (puede venir como lista separada por
  // comas); si no hay, intentamos x-real-ip.
  const forwardedFor = hdrs.get("x-forwarded-for");
  const consentIp =
    forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
  const consentUserAgent = hdrs.get("user-agent") || null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      consentIp,
      consentUserAgent,
    },
  });

  redirect("/ideas");
}
