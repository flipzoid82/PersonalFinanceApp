// @vitest-environment node

import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const SECRET = "integration-auth-secret-that-is-at-least-32-characters";
let prisma: PrismaClient;

function digest(token: string) {
  return createHmac("sha256", SECRET).update(token).digest("hex");
}

describeDatabase("Milestone 7.5 session persistence", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test")) {
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    }
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => prisma?.$disconnect());

  it("persists independent deadlines, digest-only identity, and revocation audit", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "session-owner@example.test",
        passwordHash: "disabled",
      },
    });
    const rawToken = "raw-session-token-that-must-never-be-persisted";
    const authenticatedAt = new Date("2026-07-26T10:00:00.000Z");
    const session = await prisma.authSession.create({
      data: {
        absoluteExpiresAt: new Date("2026-07-26T18:00:00.000Z"),
        authenticatedAt,
        idleExpiresAt: new Date("2026-07-26T10:15:00.000Z"),
        lastActivityAt: authenticatedAt,
        tokenHash: digest(rawToken),
        userId: owner.id,
      },
    });

    expect(session.tokenHash).toBe(digest(rawToken));
    expect(JSON.stringify(session)).not.toContain(rawToken);
    expect(session.idleExpiresAt).not.toEqual(session.absoluteExpiresAt);

    const revokedAt = new Date("2026-07-26T10:05:00.000Z");
    await prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt, revocationReason: "USER_LOGOUT" },
    });
    expect(
      await prisma.authSession.findUniqueOrThrow({ where: { id: session.id } }),
    ).toMatchObject({ revokedAt, revocationReason: "USER_LOGOUT" });
  });

  it("keeps sessions owner-scoped through their required relation", async () => {
    const [owner, other] = await Promise.all([
      prisma.user.create({
        data: {
          email: "session-scope-owner@example.test",
          passwordHash: "disabled",
        },
      }),
      prisma.user.create({
        data: {
          email: "session-scope-other@example.test",
          passwordHash: "disabled",
        },
      }),
    ]);
    const authenticatedAt = new Date("2026-07-26T10:00:00.000Z");
    await Promise.all(
      [owner, other].map((user, index) =>
        prisma.authSession.create({
          data: {
            absoluteExpiresAt: new Date("2026-07-26T18:00:00.000Z"),
            authenticatedAt,
            idleExpiresAt: new Date("2026-07-26T10:15:00.000Z"),
            lastActivityAt: authenticatedAt,
            tokenHash: digest(`owner-scope-token-${index}`),
            userId: user.id,
          },
        }),
      ),
    );

    expect(
      await prisma.authSession.count({ where: { userId: owner.id } }),
    ).toBe(1);
    expect(
      await prisma.authSession.count({ where: { userId: other.id } }),
    ).toBe(1);
  });

  it("enforces digest uniqueness under concurrent repeated creation", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "session-concurrency@example.test",
        passwordHash: "disabled",
      },
    });
    const authenticatedAt = new Date("2026-07-26T10:00:00.000Z");
    const data = {
      absoluteExpiresAt: new Date("2026-07-26T18:00:00.000Z"),
      authenticatedAt,
      idleExpiresAt: new Date("2026-07-26T10:15:00.000Z"),
      lastActivityAt: authenticatedAt,
      tokenHash: digest("same-concurrent-token"),
      userId: owner.id,
    };

    const results = await Promise.allSettled([
      prisma.authSession.create({ data }),
      prisma.authSession.create({ data }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      await prisma.authSession.count({ where: { tokenHash: data.tokenHash } }),
    ).toBe(1);
  });
});
