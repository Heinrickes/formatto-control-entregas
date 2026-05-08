import { z } from "zod";

export const businessLines = ["Constructora", "Particulares", "Retail", "Convenio Marco"] as const;
export const projectTypes = ["Edificio", "Casas", "Mixto", "No aplica"] as const;
export const fabricationTypes = ["RTA", "ARMADO"] as const;
export const productionStages = ["Plan", "Corte", "Enchape", "Perforado", "Consolidado", "Embalaje", "Armado", "CD"] as const;

export const dispatchTypes = [
  "COCINA",
  "CLOSET",
  "BAÑO",
  "PUERTAS ABATIR",
  "PUERTAS CLOSET",
  "MARCOS CLOSET",
  "PIERNAS",
  "VANITORIO",
  "QUINCALLERIA",
  "ADICIONAL",
  "MUEBLE",
  "POST VENTA"
] as const;

export const stateSchema = z.enum(["pendiente", "parcial", "despachado", "cambio"]);
export const businessLineSchema = z.enum(businessLines);
export const projectTypeSchema = z.enum(projectTypes);
export const fabricationTypeSchema = z.enum(fabricationTypes);
export const productionStageSchema = z.enum(productionStages);

export const dispatchInputSchema = z.object({
  id: z.string().optional(),
  legacyId: z.number().int().optional().nullable(),
  businessLine: businessLineSchema.default("Constructora"),
  project: z.string().min(1),
  projectType: projectTypeSchema.default("Edificio"),
  type: z.string().min(1),
  description: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
  tower: z.string().optional().nullable(),
  core: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  fabricationType: fabricationTypeSchema.default("RTA"),
  productionStage: productionStageSchema.default("Plan"),
  productionStartAt: z.string().optional().nullable(),
  units: z.coerce.number().int().min(0).default(0),
  originalScheduledAt: z.string().optional().nullable(),
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
