import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerCount = await prisma.user.count();
  if (ownerCount < 1) {
    console.error("OWNER_MISSING");
    process.exitCode = 2;
    return;
  }
  console.log("OWNER_PRESENT");
}

main()
  .catch(() => {
    console.error("OWNER_CHECK_FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
