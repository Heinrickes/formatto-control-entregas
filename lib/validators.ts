import { z } from "zod";

export const dispatchTypes = [
  "COCINA",
  "CLOSET",
  "BAÑO",
  "PUERTAS ABATIR",
  "MARCOS CLOSET",
  "QUINCALLERIA",
  "ADICIONAL",
  "POST VENTA"
] as const;

export const stateSchema = z.enum(["pendiente", "despachado", "cambio"]);

export const dispatchInputSchema = z.object({
  id: z.string().optional(),
  legacyId: z.number().int().optional().nullable(),
  project: z.string().min(1),
  type: z.string().min(1),
  detail: z.string().optional().nullable(),
  tower: z.string().optional().nullable(),
  core: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  units: z.coerce.number().int().min(0).default(0),
  scheduledAt: z.string().min(10),
  source: z.enum(["programa", "excel", "manual"]).default("programa"),
  sortOrder: z.coerce.number().int().default(0)
});

export const programInputSchema = z.object({
  name: z.string().min(1),
  builder: z.string().min(1),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  active: z.boolean().optional(),
  dispatches: z.array(dispatchInputSchema).default([])
});

export const statusInputSchema = z.object({
  state: stateSchema,
  actualAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});
