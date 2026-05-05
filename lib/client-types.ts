export type Role = "admin" | "operador" | "lector";
export type DispatchState = "pendiente" | "parcial" | "despachado" | "cambio";
export type BusinessLine = "Constructora" | "Particulares" | "Retail" | "Convenio Marco";
export type ProjectType = "Edificio" | "Casas" | "Mixto" | "No aplica";
export type FabricationType = "RTA" | "ARMADO";
export type ProductionStage = "Corte" | "Enchape" | "Perforado" | "Consolidado" | "Embalaje" | "Armado" | "CD";

export type DispatchRow = {
  id: string;
  legacyId?: number | null;
  businessLine: BusinessLine;
  project: string;
  projectType: ProjectType;
  type: string;
  description?: string | null;
  detail?: string | null;
  tower?: string | null;
  core?: string | null;
  floor?: string | null;
  fabricationType: FabricationType;
  productionStage: ProductionStage;
  productionStartAt?: string | null;
  units: number;
  scheduledAt: string;
  source: "programa" | "excel" | "manual";
  sortOrder: number;
  parentDispatchId?: string | null;
  status?: {
    state: DispatchState;
    actualAt?: string | null;
    notes?: string | null;
    updatedAt?: string;
  } | null;
  events?: Array<{
    id: string;
    state: DispatchState;
    actualAt?: string | null;
    notes?: string | null;
    createdAt: string;
  }>;
};

export type ProgramSummary = {
  id: string;
  name: string;
  builder: string;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  _count?: { dispatches: number };
};

export type DashboardPayload = {
  program: (ProgramSummary & { dispatches: DispatchRow[] }) | null;
  summary: {
    total: number;
    dispatched: number;
    partial: number;
    pending: number;
    changes: number;
    completion: number;
    averageDelay: number | null;
    projects: number;
    onTime: number;
    late: number;
    early: number;
    onTimeRate: number;
    lateRate: number;
    earlyRate: number;
  };
  projectPerformance?: Array<{
    project: string;
    total: number;
    dispatched: number;
    partial: number;
    onTime: number;
    late: number;
    early: number;
    completion: number;
    onTimeRate: number;
    lateRate: number;
    earlyRate: number;
  }>;
  businessLinePerformance?: Array<{
    businessLine: BusinessLine | string;
    total: number;
    dispatched: number;
    partial: number;
    pending: number;
    changes: number;
    completion: number;
  }>;
  dispatches: DispatchRow[];
};
