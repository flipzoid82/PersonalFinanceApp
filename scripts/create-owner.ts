import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const displayName = process.env.OWNER_NAME?.trim() || null;

  if (!email || !email.includes("@"))
    throw new Error(
      "Usage: OWNER_PASSWORD=<password> pnpm owner:create owner@example.com",
    );
  if (!password || password.length < 12)
    throw new Error("OWNER_PASSWORD must contain at least 12 characters.");
  const existingOwner = await prisma.user.findFirst();
  if (existingOwner && existingOwner.email !== email)
    throw new Error(
      "An owner already exists. This application supports one owner only.",
    );
  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: { displayName, passwordHash },
    create: { email, displayName, passwordHash },
  });
  console.log(`Owner account configured for ${email}.`);
}

main().finally(() => prisma.$disconnect());
