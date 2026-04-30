export type Role = "admin" | "operador" | "lector";
export type DispatchState = "pendiente" | "parcial" | "despachado" | "cambio";

export type DispatchRow = {
  id: string;
  legacyId?: number | null;
  project: string;
  type: string;
  detail?: string | null;
  tower?: string | null;
  core?: string | null;
  floor?: string | null;
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
  dispatches: DispatchRow[];
};
