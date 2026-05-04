import { z } from "zod";

export const businessLines = ["Constructora", "Particulares", "Retail", "Convenio Marco"] as const;

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

export const stateSchema = z.enum(["pendiente", "parcial", "despachado", "cambio"]);
export const businessLineSchema = z.enum(businessLines);

export const dispatchInputSchema = z.object({
  id: z.string().optional(),
  legacyId: z.number().int().optional().nullable(),
  businessLine: businessLineSchema.default("Constructora"),
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
  completionDueAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});
