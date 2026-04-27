import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ ok: true, database: "up" });
  } catch (error) {
    return Response.json({ ok: false, database: "down", error: String(error) }, { status: 503 });
  }
}
