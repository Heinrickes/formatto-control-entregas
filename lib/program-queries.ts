import { Prisma } from "@prisma/client";

export const programInclude = {
  dispatches: {
    orderBy: [{ sortOrder: "asc" }, { scheduledAt: "asc" }] as Prisma.DispatchOrderByWithRelationInput[],
    include: {
      status: true,
      events: {
        orderBy: { createdAt: "desc" } as Prisma.DispatchEventOrderByWithRelationInput,
        take: 8,
        include: { actor: true }
      }
    }
  }
};
