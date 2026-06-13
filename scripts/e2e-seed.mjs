import { readFileSync } from "node:fs";
// Load .env.local into process.env (node doesn't do this automatically)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!(k in process.env)) process.env[k] = v;
}
const { PrismaClient } = await import("@prisma/client");
const bcrypt = (await import("bcryptjs")).default;
const prisma = new PrismaClient();
const cmd = process.argv[2] || "create";
const stamp = process.argv[3] || "manual";
const email = `e2e-bot-${stamp}@test.local`;
if (cmd === "create") {
  const password = "E2eBot!" + stamp;
  const hash = await bcrypt.hash(password, 10);
  const u = await prisma.user.upsert({
    where: { email },
    update: { password: hash },
    create: { email, name: "E2E Bot", password: hash, isAdmin: false },
  });
  console.log(JSON.stringify({ email, password, id: u.id }));
} else if (cmd === "cleanup") {
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) {
    // ideas cascade? delete ideas + projects explicitly to be safe
    const ideas = await prisma.idea.findMany({ where: { userId: u.id }, select: { id: true } });
    console.log(JSON.stringify({ deletingUser: u.id, ideas: ideas.length }));
    await prisma.user.delete({ where: { id: u.id } });
    console.log("deleted");
  } else {
    console.log("no such user");
  }
}
await prisma.$disconnect();
