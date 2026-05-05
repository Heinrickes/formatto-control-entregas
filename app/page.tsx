"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Activity, BarChart3, Briefcase, Building2, CalendarClock, ClipboardList, Download, Edit3, Eye, EyeOff, FilterX, FolderKanban, History, Layers, ListFilter, LogOut, Plus, RefreshCw, Save, Search, Shield, SlidersHorizontal, Trash2, Upload, Users } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import type { DashboardPayload, DispatchRow, DispatchState, ProgramSummary, Role } from "@/lib/client-types";
import { cleanLocationValue, normalizeProjectName } from "@/lib/formatting";

const businessLines = ["Constructora", "Particulares", "Retail", "Convenio Marco"] as const;
const projectTypes = ["Edificio", "Casas", "Mixto", "No aplica"] as const;
const dispatchTypes = ["COCINA", "CLOSET", "BAÑO", "PUERTAS ABATIR", "PUERTAS CLOSET", "MARCOS CLOSET", "PIERNAS", "VANITORIO", "QUINCALLERIA", "ADICIONAL", "MUEBLE", "POST VENTA"];
const dispatchStateOptions: DispatchState[] = ["pendiente", "parcial", "despachado", "cambio"];
const fabricationTypes = ["RTA", "ARMADO"] as const;
const productionStages = ["Plan", "Corte", "Enchape", "Perforado", "Consolidado", "Embalaje", "Armado", "CD"] as const;
const productionRoutes = {
  RTA: ["Plan", "Corte", "Enchape", "Perforado", "Consolidado", "Embalaje", "CD"],
  ARMADO: ["Plan", "Corte", "Enchape", "Perforado", "Consolidado", "Armado", "CD"]
} as const;
const APP_TIME_ZONE = "America/Santiago";
const APP_TODAY = "";

type TaskDraft = {
  businessLine: string;
  project: string;
  projectType: string;
  type: string;
  description: string;
  detail: string;
  tower: string;
  core: string;
  floor: string;
  fabricationType: string;
  productionStage: string;
  productionStartAt: string;
  units: string;
  scheduledAt: string;
};

type Session = {
  email: string;
  role: Role;
  name: string;
};

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  area?: string | null;
  position?: string | null;
  active: boolean;
  mustChangePassword: boolean;
};

type UserDraft = {
  email: string;
  fullName: string;
  role: Role;
  area: string;
  position: string;
  password: string;
  active: boolean;
};

type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  summary: string;
  createdAt: string;
};

type PresenceRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lastSeenAt: string;
  lastActivity?: string | null;
};

type DashboardView = "dashboard" | "dispatch" | "urgent" | "tasks";

const emptyTask = (): TaskDraft => ({
  businessLine: "Constructora",
  project: "",
  projectType: "Edificio",
  type: "COCINA",
  description: "",
  detail: "",
  tower: "",
  core: "",
  floor: "",
  fabricationType: "RTA",
  productionStage: "Plan",
  productionStartAt: "",
  units: "0",
  scheduledAt: todayOnly()
});

function todayOnly() {
  if (APP_TODAY) return APP_TODAY;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: APP_TIME_ZONE }).format(date);
}

function ymdToUtc(dateOnlyValue: string) {
  const [year, month, day] = dateOnlyValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function utcToYmd(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(dateOnlyValue: string, days: number) {
  const date = ymdToUtc(dateOnlyValue);
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isBusinessDay(date)) remaining--;
  }
  return utcToYmd(date);
}

function businessDiffDays(scheduled: string, actual?: string | null) {
  if (!actual) return null;
  const start = ymdToUtc(dateOnly(scheduled));
  const end = ymdToUtc(dateOnly(actual));
  if (start.getTime() === end.getTime()) return 0;
  const direction = end > start ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;
  while ((direction > 0 && cursor < end) || (direction < 0 && cursor > end)) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    if (isBusinessDay(cursor)) count += direction;
  }
  return count;
}

function timeState(row: DispatchRow) {
  const state = row.status?.state ?? "pendiente";
  const target = state === "despachado" ? row.status?.actualAt : todayOnly();
  const diff = businessDiffDays(row.scheduledAt, target);
  if (diff === null) return { label: "-", tone: "text-[var(--mut)]", value: 0 };
  if (state === "despachado") {
    if (diff === 0) return { label: "En fecha", tone: "text-[var(--mut)]", value: diff };
    if (diff > 0) return { label: `${diff}d atraso`, tone: "text-[var(--bad)]", value: diff };
    return { label: `${Math.abs(diff)}d adelanto`, tone: "text-[var(--ok)]", value: diff };
  }
  if (diff > 0) return { label: `${diff}d atrasado`, tone: "text-[var(--bad)]", value: diff };
  if (diff === 0) return { label: "Hoy", tone: "text-[var(--warn)]", value: diff };
  return { label: `${Math.abs(diff)}d restantes`, tone: "text-[var(--mut)]", value: diff };
}

function taskPriority(row: DispatchRow) {
  const state = row.status?.state ?? "pendiente";
  const time = timeState(row);
  if (state !== "despachado" && time.value > 0) return 0; // atrasado pendiente
  if (state === "despachado" && time.value > 0) return 1; // despachado con atraso, ya no es urgencia pero si castigo
  if (state !== "despachado" && time.value >= -7) return 2; // proximos despachos a cumplir
  if (state !== "despachado") return 3; // pendiente futuro
  if (time.value < 0) return 4; // despachado adelantado
  if (time.value === 0) return 5; // entregado on time
  return 6;
}

function typeClass(type: string) {
  if (type === "COCINA") return "bg-[var(--org)]";
  if (type === "CLOSET") return "bg-[var(--blk)]";
  if (type === "BAÑO") return "bg-[#5a5a5a]";
  if (type === "MARCOS CLOSET") return "bg-[#7b5ea7]";
  if (type === "QUINCALLERIA") return "bg-[#2e86ab]";
  if (type === "ADICIONAL") return "bg-[#e9a825]";
  return "bg-[var(--g3)]";
}

function statusClass(state: DispatchState) {
  if (state === "despachado") return "status-despachado";
  if (state === "parcial") return "status-parcial";
  if (state === "cambio") return "status-cambio";
  return "status-pendiente";
}

function toTaskDraft(row: DispatchRow): TaskDraft {
  return {
    businessLine: row.businessLine ?? "Constructora",
    project: row.project,
    projectType: row.projectType ?? "Edificio",
    type: row.type,
    description: row.description ?? "",
    detail: row.detail ?? "",
    tower: row.tower ?? "",
    core: row.core ?? "",
    floor: row.floor ?? "",
    fabricationType: row.fabricationType ?? "RTA",
    productionStage: row.productionStage ?? "Plan",
    productionStartAt: dateOnly(row.productionStartAt),
    units: String(row.units ?? 0),
    scheduledAt: dateOnly(row.scheduledAt)
  };
}

function houseLocationFromDetail(row: Pick<DispatchRow, "projectType" | "detail">) {
  if (row.projectType !== "Casas" || !row.detail) return "";
  const match = row.detail.match(/^casas?\s+(.+)/i);
  return match?.[1]?.trim() ?? "";
}

function locationDetail(row: Pick<DispatchRow, "projectType" | "tower" | "core" | "floor" | "detail">) {
  if (row.projectType === "Casas") {
    const houseValue = cleanLocationValue(row.floor, "piso") || houseLocationFromDetail(row);
    return houseValue ? `Casa ${houseValue}` : "";
  }
  return [
    cleanLocationValue(row.tower, "torre") ? `Torre ${cleanLocationValue(row.tower, "torre")}` : "",
    cleanLocationValue(row.core, "nucleo") ? `Núcleo ${cleanLocationValue(row.core, "nucleo")}` : "",
    cleanLocationValue(row.floor, "piso") ? `Piso ${cleanLocationValue(row.floor, "piso")}` : ""
  ].filter(Boolean).join(" · ");
}

function displayDispatchDetail(row: DispatchRow) {
  const detail = row.businessLine === "Constructora"
    ? row.detail?.replace(new RegExp(`^${row.type}\\s*[-:·]?\\s*`, "i"), "").trim()
    : row.detail;
  const parts = row.businessLine === "Constructora"
    ? [locationDetail(row), detail]
    : [row.description, locationDetail(row), detail];
  return parts.filter(Boolean).join(" · ") || "-";
}

function dispatchObservation(row: DispatchRow) {
  if (row.businessLine === "Constructora") {
    if (row.projectType === "Casas" && houseLocationFromDetail(row)) return "-";
    return row.detail?.replace(new RegExp(`^${row.type}\\s*[-:·]?\\s*`, "i"), "").trim() || "-";
  }
  return [row.description, row.detail].filter(Boolean).join(" · ") || "-";
}

function productionRouteFor(type?: string | null) {
  return type === "ARMADO" ? productionRoutes.ARMADO : productionRoutes.RTA;
}

function normalizeProductionStage(value?: string | null) {
  const clean = (value ?? "").trim().toLowerCase();
  if (clean === "plan" || clean === "planificado") return "Plan";
  return productionStages.find((stage) => stage.toLowerCase() === clean) ?? "Plan";
}

function productionProgress(row: Pick<DispatchRow, "fabricationType" | "productionStage">) {
  const route = productionRouteFor(row.fabricationType);
  const currentIndex = Math.max(0, route.findIndex((stage) => stage === normalizeProductionStage(row.productionStage)));
  return { route, currentIndex, percent: route.length > 1 ? Math.round((currentIndex / (route.length - 1)) * 100) : 0 };
}

function productionWindow(row: Pick<DispatchRow, "productionStartAt" | "scheduledAt">) {
  const days = businessDiffDays(row.productionStartAt ?? "", row.scheduledAt);
  if (days === null) return { label: "Sin ingreso", tone: "text-[var(--mut)]", value: null };
  if (days < 0) return { label: `${Math.abs(days)}d fuera`, tone: "text-[var(--bad)]", value: days };
  if (days === 0) return { label: "Mismo dia", tone: "text-[var(--warn)]", value: days };
  return { label: `${days}d prod.`, tone: "text-[var(--ok)]", value: days };
}

function unitLabel(row: Pick<DispatchRow, "businessLine" | "projectType" | "units">) {
  const count = row.units || 0;
  if ((row.businessLine ?? "Constructora") !== "Constructora") return `${count || "-"} muebles`;
  if (row.projectType === "Casas") return `${count || "-"} casas`;
  if (row.projectType === "Edificio") return `${count || "-"} deptos`;
  if (row.projectType === "Mixto") return `${count || "-"} uds mixtas`;
  return `${count || "-"} uds`;
}

function spreadsheetDateOnly(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 86400000).toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : dateOnly(parsed.toISOString());
}

function primaryLocationLabel(row: DispatchRow) {
  if ((row.businessLine ?? "Constructora") !== "Constructora") return String(row.units || "-");
  return locationDetail(row) || "-";
}

function secondaryLocationLabel(row: DispatchRow) {
  if ((row.businessLine ?? "Constructora") !== "Constructora") return "";
  return unitLabel(row);
}

function quantityClass(row: DispatchRow) {
  return (row.businessLine ?? "Constructora") !== "Constructora"
    ? "text-sm font-bold leading-tight text-[var(--blk)]"
    : "break-words font-semibold leading-tight";
}

function locationCellClass(row: DispatchRow) {
  return "min-w-0 border-l-2 border-[var(--org)] pl-2 text-left";
}

export function DashboardApp({ defaultView = "dashboard" }: { defaultView?: DashboardView }) {
  const [session, setSession] = useState<Session | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [programId, setProgramId] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [businessLineFilter, setBusinessLineFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [stateFilter, setStateFilter] = useState<DispatchState | "todos">("todos");
  const [projectFilter, setProjectFilter] = useState("todos");
  const [timeFilter, setTimeFilter] = useState<"todos" | "atrasadas" | "hoy" | "proximas">("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DispatchRow | null>(null);
  const [taskModal, setTaskModal] = useState<{ mode: "create" | "edit"; row?: DispatchRow } | null>(null);
  const [auditModal, setAuditModal] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([]);
  const [projectSort, setProjectSort] = useState<"prioridad" | "atraso" | "cumplimiento" | "nombre">("prioridad");
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<{ active: boolean; total: number; processed: number; created: number; updated: number; skipped: number; error?: string }>({ active: false, total: 0, processed: 0, created: 0, updated: 0, skipped: 0 });
  const [productionPendingIds, setProductionPendingIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const productionRequestSeq = useRef(0);
  const productionPendingRef = useRef<Record<string, { requestId: number; snapshot: DispatchRow; optimistic: DispatchRow }>>({});
  const showDispatch = defaultView === "dashboard" || defaultView === "dispatch";
  const showUrgent = defaultView === "dashboard" || defaultView === "urgent";
  const showTasks = defaultView === "dashboard" || defaultView === "tasks";

  const clearConnectionMessage = useCallback(() => {
    setMessage((current) => current.startsWith("No se pudo cargar el tablero") || current.startsWith("No se pudo conectar con la API") ? "" : current);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("formatto-session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  const role = session?.role ?? "lector";
  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-formatto-role": role }), [role]);

  const loadPrograms = useCallback(async () => {
    const res = await fetch("/api/programs", { headers });
    if (!res.ok) throw new Error("No se pudo cargar programas.");
    const data = await res.json();
    const list = data.programs ?? [];
    setPrograms(list);
    const active =
      list.find((p: ProgramSummary) => p.active && (p._count?.dispatches ?? 0) > 0) ??
      [...list].sort((a: ProgramSummary, b: ProgramSummary) => (b._count?.dispatches ?? 0) - (a._count?.dispatches ?? 0))[0];
    if (active && !programId) setProgramId(active.id);
    clearConnectionMessage();
  }, [clearConnectionMessage, headers, programId]);

  const keepPendingProduction = useCallback((nextPayload: DashboardPayload) => {
    const pending = productionPendingRef.current;
    if (Object.keys(pending).length === 0) return nextPayload;
    const replaceDispatch = (rows: DispatchRow[] = []) =>
      rows.map((row) => pending[row.id] ? { ...row, ...pending[row.id].optimistic } : row);
    return {
      ...nextPayload,
      dispatches: replaceDispatch(nextPayload.dispatches),
      program: nextPayload.program ? { ...nextPayload.program, dispatches: replaceDispatch(nextPayload.program.dispatches) } : nextPayload.program
    };
  }, []);

  const loadDashboard = useCallback(async (id = programId) => {
    const suffix = id ? `?programId=${id}` : "";
    const res = await fetch(`/api/dashboard${suffix}`, { headers });
    if (!res.ok) throw new Error("No se pudo cargar dashboard.");
    const data = await res.json();
    setPayload(keepPendingProduction(data));
    clearConnectionMessage();
  }, [clearConnectionMessage, headers, keepPendingProduction, programId]);

  useEffect(() => {
    loadPrograms().catch(() => setMessage("No se pudo cargar el tablero. Revisa Supabase y DATABASE_URL."));
  }, [loadPrograms]);

  useEffect(() => {
    loadDashboard().catch(() => setMessage("No se pudo conectar con la API."));
  }, [loadDashboard]);

  useEffect(() => {
    if (!session) return;
    const heartbeat = () => {
      fetch("/api/presence", {
        method: "POST",
        headers,
        body: JSON.stringify({ activity: document.visibilityState === "visible" ? "Tablero" : "Sesion en segundo plano" })
      }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [headers, session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadDashboard, session]);

  const dispatches = useMemo(() => {
    let rows = payload?.dispatches ?? [];
    if (businessLineFilter !== "todos") rows = rows.filter((row) => (row.businessLine ?? "Constructora") === businessLineFilter);
    if (typeFilter !== "todos") rows = rows.filter((row) => row.type === typeFilter);
    if (stateFilter !== "todos") rows = rows.filter((row) => (row.status?.state ?? "pendiente") === stateFilter);
    if (projectFilter !== "todos") rows = rows.filter((row) => row.project === projectFilter);
    if (timeFilter !== "todos") {
      rows = rows.filter((row) => {
        const state = row.status?.state ?? "pendiente";
        const time = timeState(row);
        if (state === "despachado") return false;
        if (timeFilter === "atrasadas") return time.value > 0;
        if (timeFilter === "hoy") return time.value === 0;
        return time.value < 0 && Math.abs(time.value) <= 7;
      });
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      rows = rows.filter((row) => [row.businessLine, row.project, row.type, row.description, row.detail, row.tower, row.core, row.floor, String(row.units)].join(" ").toLowerCase().includes(term));
    }
    return rows.slice().sort((a, b) => {
      const ta = timeState(a);
      const tb = timeState(b);
      const sa = a.status?.state ?? "pendiente";
      const sb = b.status?.state ?? "pendiente";
      const rank = (row: DispatchRow, time: ReturnType<typeof timeState>) => {
        const state = row.status?.state ?? "pendiente";
        if (state !== "despachado" && time.value > 0) return 0;
        if (state !== "despachado" && time.value === 0) return 1;
        if (state === "cambio") return 2;
        if (state !== "despachado" && time.value < 0 && Math.abs(time.value) <= 7) return 3;
        if (state !== "despachado") return 4;
        return 5;
      };
      const ra = rank(a, ta);
      const rb = rank(b, tb);
      if (ra !== rb) return ra - rb;
      if (sa !== sb && (sa === "despachado" || sb === "despachado")) return sa === "despachado" ? 1 : -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  }, [payload, businessLineFilter, typeFilter, stateFilter, projectFilter, timeFilter, search]);

  const rowsForFilterOptions = useCallback((skip: "businessLine" | "project" | "type" | "state" | "time") => {
    let rows = payload?.dispatches ?? [];
    if (skip !== "businessLine" && businessLineFilter !== "todos") rows = rows.filter((row) => (row.businessLine ?? "Constructora") === businessLineFilter);
    if (skip !== "type" && typeFilter !== "todos") rows = rows.filter((row) => row.type === typeFilter);
    if (skip !== "state" && stateFilter !== "todos") rows = rows.filter((row) => (row.status?.state ?? "pendiente") === stateFilter);
    if (skip !== "project" && projectFilter !== "todos") rows = rows.filter((row) => row.project === projectFilter);
    if (skip !== "time" && timeFilter !== "todos") {
      rows = rows.filter((row) => {
        const state = row.status?.state ?? "pendiente";
        const time = timeState(row);
        if (state === "despachado") return false;
        if (timeFilter === "atrasadas") return time.value > 0;
        if (timeFilter === "hoy") return time.value === 0;
        return time.value < 0 && Math.abs(time.value) <= 7;
      });
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      rows = rows.filter((row) => [row.businessLine, row.project, row.type, row.description, row.detail, row.tower, row.core, row.floor, String(row.units)].join(" ").toLowerCase().includes(term));
    }
    return rows;
  }, [businessLineFilter, payload, projectFilter, search, stateFilter, timeFilter, typeFilter]);

  const projects = useMemo(() => ["todos", ...Array.from(new Set(rowsForFilterOptions("project").map((row) => row.project))).sort()], [rowsForFilterOptions]);
  const availableTypes = useMemo(() => ["todos", ...Array.from(new Set(rowsForFilterOptions("type").map((row) => row.type))).sort()], [rowsForFilterOptions]);
  const availableStates = useMemo<Array<DispatchState | "todos">>(() => ["todos", ...dispatchStateOptions.filter((state) => rowsForFilterOptions("state").some((row) => (row.status?.state ?? "pendiente") === state))], [rowsForFilterOptions]);
  const availableBusinessLines = useMemo(() => ["todos", ...businessLines.filter((line) => rowsForFilterOptions("businessLine").some((row) => (row.businessLine ?? "Constructora") === line))], [rowsForFilterOptions]);
  useEffect(() => {
    if (projectFilter !== "todos" && !projects.includes(projectFilter)) setProjectFilter("todos");
    if (typeFilter !== "todos" && !availableTypes.includes(typeFilter)) setTypeFilter("todos");
    if (stateFilter !== "todos" && !availableStates.includes(stateFilter)) setStateFilter("todos");
    if (businessLineFilter !== "todos" && !availableBusinessLines.includes(businessLineFilter)) setBusinessLineFilter("todos");
  }, [availableBusinessLines, availableStates, availableTypes, businessLineFilter, projectFilter, projects, stateFilter, typeFilter]);
  const activeProgram = payload?.program ?? programs.find((program) => program.id === programId) ?? programs.find((program) => program.active);

  const start = useMemo(() => {
    const dates = dispatches.map((row) => new Date(row.scheduledAt).getTime());
    return dates.length ? Math.min(...dates) : Date.now();
  }, [dispatches]);

  const end = useMemo(() => {
    const dates = dispatches.map((row) => new Date(row.scheduledAt).getTime());
    return dates.length ? Math.max(...dates) : Date.now();
  }, [dispatches]);

  const span = Math.max(1, Math.round((end - start) / 86400000));
  const summary = payload?.summary ?? { total: 0, dispatched: 0, partial: 0, pending: 0, changes: 0, completion: 0, averageDelay: null, projects: 0, onTime: 0, late: 0, early: 0, onTimeRate: 0, lateRate: 0, earlyRate: 0 };
  const totalBuckets = useMemo(() => {
    const rows = payload?.dispatches ?? [];
    const result = rows.reduce(
      (acc, row) => {
        if ((row.status?.state ?? "pendiente") !== "despachado") return acc;
        const diff = businessDiffDays(row.scheduledAt, row.status?.actualAt);
        if (diff === null) return acc;
        if (diff > 0) acc.late++;
        else if (diff < 0) acc.early++;
        else acc.onTime++;
        return acc;
      },
      { late: 0, onTime: 0, early: 0 }
    );
    const partialTotal = rows.filter((row) => (row.status?.state ?? "pendiente") === "parcial").length;
    const pendingTotal = rows.filter((row) => {
      const state = row.status?.state ?? "pendiente";
      return state !== "despachado" && state !== "parcial";
    }).length;
    const rate = (value: number) => rows.length ? Math.round((value / rows.length) * 100) : 0;
    return {
      ...result,
      pending: pendingTotal,
      partial: partialTotal,
      lateRate: rate(result.late),
      onTimeRate: rate(result.onTime),
      earlyRate: rate(result.early),
      pendingRate: rate(pendingTotal),
      partialRate: rate(partialTotal)
    };
  }, [payload]);
  const productionMetrics = useMemo(() => {
    const rows = payload?.dispatches ?? [];
    const inProduction = rows.filter((row) => (row.productionStage ?? "Plan") !== "CD").length;
    const cd = rows.filter((row) => row.productionStage === "CD").length;
    const withoutStart = rows.filter((row) => !row.productionStartAt).length;
    const leadTimes = rows
      .map((row) => productionWindow(row).value)
      .filter((value): value is number => value !== null && value >= 0);
    return {
      inProduction,
      cd,
      withoutStart,
      averageLead: leadTimes.length ? Math.round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length) : null
    };
  }, [payload]);
  const selectedProjectPerformance = useMemo(() => {
    if (projectFilter === "todos") return null;
    return payload?.projectPerformance?.find((item) => item.project === projectFilter) ?? null;
  }, [payload, projectFilter]);
  const groupedDispatches = useMemo(() => {
    const map = new Map<string, DispatchRow[]>();
    dispatches.forEach((row) => map.set(row.project, [...(map.get(row.project) ?? []), row]));
    return Array.from(map.entries()).map(([project, rows]) => {
      const performance = payload?.projectPerformance?.find((item) => item.project === project);
      const pendingCritical = rows.filter((row) => {
        const state = row.status?.state ?? "pendiente";
        return state !== "despachado" && timeState(row).value >= 0;
      }).length;
      const delayedTasks = rows.filter((row) => timeState(row).value > 0).length;
      const upcomingTasks = rows.filter((row) => {
        const state = row.status?.state ?? "pendiente";
        const value = timeState(row).value;
        return state !== "despachado" && value <= 0 && value >= -7;
      }).length;
      const projectRows = rows.slice().sort((a, b) => taskPriority(a) - taskPriority(b) || new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      const maxDelay = projectRows.reduce((max, row) => {
        return Math.max(max, timeState(row).value);
      }, 0);
      const priority = Math.min(...projectRows.map(taskPriority));
      return { project, rows: projectRows, performance, pendingCritical, delayedTasks, upcomingTasks, maxDelay, priority };
    }).sort((a, b) => {
      if (projectSort === "nombre") return a.project.localeCompare(b.project);
      if (projectSort === "cumplimiento") return (a.performance?.completion ?? 0) - (b.performance?.completion ?? 0);
      if (projectSort === "prioridad" && a.priority !== b.priority) return a.priority - b.priority;
      if (a.maxDelay !== b.maxDelay) return b.maxDelay - a.maxDelay;
      if (a.delayedTasks !== b.delayedTasks) return b.delayedTasks - a.delayedTasks;
      if (a.pendingCritical !== b.pendingCritical) return b.pendingCritical - a.pendingCritical;
      return (b.performance?.lateRate ?? 0) - (a.performance?.lateRate ?? 0);
    });
  }, [dispatches, payload, projectSort]);
  const groupedByBusinessLine = useMemo(() => {
    return businessLines
      .map((line) => ({
        line,
        groups: groupedDispatches.filter((group) => (group.rows[0]?.businessLine ?? "Constructora") === line)
      }))
      .filter((section) => section.groups.length > 0);
  }, [groupedDispatches]);
  const urgentRows = useMemo(() => {
    return dispatches
      .filter((row) => (row.status?.state ?? "pendiente") !== "despachado")
      .map((row) => ({ row, time: timeState(row) }))
      .filter((item) => item.time.value >= 0 || Math.abs(item.time.value) <= 3 || item.row.status?.state === "cambio")
      .sort((a, b) => b.time.value - a.time.value)
      .slice(0, 8);
  }, [dispatches]);
  const timelineRows = useMemo(() => {
    return dispatches
      .slice()
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .filter((row) => (row.status?.state ?? "pendiente") !== "despachado");
  }, [dispatches]);

  function toggleChecked(id: string) {
    setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visibleIds = dispatches.map((row) => row.id);
    const allVisibleChecked = visibleIds.every((id) => checked.includes(id));
    setChecked(allVisibleChecked ? checked.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...checked, ...visibleIds])));
  }

  function toggleProject(project: string) {
    setCollapsedProjects((current) => current.includes(project) ? current.filter((item) => item !== project) : [...current, project]);
  }

  function toggleProjectSelection(rows: DispatchRow[]) {
    const ids = rows.map((row) => row.id);
    const allSelected = ids.every((id) => checked.includes(id));
    setChecked(allSelected ? checked.filter((id) => !ids.includes(id)) : Array.from(new Set([...checked, ...ids])));
  }

  function collapseAllProjects() {
    setCollapsedProjects(groupedDispatches.map((group) => group.project));
  }

  function expandAllProjects() {
    setCollapsedProjects([]);
  }

  function patchDispatchLocally(nextDispatch: DispatchRow) {
    const replaceDispatch = (rows: DispatchRow[] = []) =>
      rows.map((row) => row.id === nextDispatch.id ? { ...row, ...nextDispatch } : row);

    setPayload((current) => {
      if (!current) return current;
      return {
        ...current,
        dispatches: replaceDispatch(current.dispatches),
        program: current.program ? { ...current.program, dispatches: replaceDispatch(current.program.dispatches) } : current.program
      };
    });
    setSelected((current) => current?.id === nextDispatch.id ? { ...current, ...nextDispatch } : current);
  }

  function selectedRowsForAction(row: DispatchRow) {
    if (!checked.includes(row.id)) return [row];
    const rows = (payload?.dispatches ?? []).filter((item) => checked.includes(item.id));
    return rows.length ? rows : [row];
  }

  async function ensureProgram() {
    if (activeProgram?.id) return activeProgram.id;

    const today = todayOnly();
    const res = await fetch("/api/programs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Tablero principal Formatto",
        builder: "Formatto",
        startsAt: today,
        active: true,
        dispatches: []
      })
    });
    if (!res.ok) throw new Error("No se pudo crear el tablero principal.");
    const data = await res.json();
    setProgramId(data.program.id);
    return data.program.id as string;
  }

  async function saveTask(draft: TaskDraft, row?: DispatchRow) {
    setBusy(true);
    try {
      const targetProgramId = await ensureProgram();
      const body = JSON.stringify({
        businessLine: draft.businessLine,
        project: normalizeProjectName(draft.project),
        projectType: draft.projectType,
        type: draft.type,
        description: draft.businessLine === "Constructora" ? null : draft.description.trim() || null,
        detail: draft.detail.trim() || null,
        tower: cleanLocationValue(draft.tower, "torre") || null,
        core: cleanLocationValue(draft.core, "nucleo") || null,
        floor: cleanLocationValue(draft.floor, "piso") || null,
        fabricationType: draft.fabricationType,
        productionStage: draft.productionStage,
        productionStartAt: draft.productionStartAt || null,
        units: Number(draft.units) || 0,
        scheduledAt: draft.scheduledAt,
        source: "manual"
      });
      const res = await fetch(row ? `/api/dispatches/${row.id}` : `/api/programs/${targetProgramId}/dispatches`, {
        method: row ? "PATCH" : "POST",
        headers,
        body
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setMessage(error.error ?? "No se pudo guardar la tarea.");
        return;
      }
      setTaskModal(null);
      setMessage(row ? "Tarea editada correctamente." : "Tarea agregada al tablero.");
      await loadPrograms();
      await loadDashboard(targetProgramId);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(row: DispatchRow) {
    if (!confirm("Eliminar esta tarea del tablero?")) return;
    setBusy(true);
    const res = await fetch(`/api/dispatches/${row.id}`, { method: "DELETE", headers });
    setBusy(false);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setMessage(error.error ?? "No se pudo eliminar la tarea.");
      return;
    }
    setSelected(null);
    setChecked((current) => current.filter((id) => id !== row.id));
    setMessage("Tarea eliminada.");
    await loadDashboard();
  }

  async function saveStatus(row: DispatchRow, state: DispatchState, actualAt: string, notes: string, completionDueAt?: string) {
    const targetRows = selectedRowsForAction(row);
    const bulkLabel = targetRows.length > 1 ? ` las ${targetRows.length} tareas seleccionadas` : " esta entrega";
    const completeProduction = state === "despachado" && targetRows.some((item) => item.productionStage !== "CD")
      ? window.confirm(`Se marcara${targetRows.length > 1 ? "n" : ""}${bulkLabel} como despachada${targetRows.length > 1 ? "s" : ""}. Deseas marcar tambien la produccion completa en CD?`)
      : false;
    setBusy(true);
    let saved = 0;
    let failed = 0;
    let productionWarning = "";

    for (const target of targetRows) {
      const res = await fetch(`/api/dispatches/${target.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state, actualAt: actualAt || null, completionDueAt: completionDueAt || null, notes })
      });
      if (!res.ok) {
        failed++;
        continue;
      }
      const data = await res.json();
      let nextRow = { ...target, status: data.status } as DispatchRow;
      patchDispatchLocally(nextRow);
      saved++;

      if (completeProduction && target.productionStage !== "CD") {
        const productionRow = { ...nextRow, productionStage: "CD" } as DispatchRow;
        patchDispatchLocally(productionRow);
        const productionRes = await fetch(`/api/dispatches/${target.id}/production`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            fabricationType: target.fabricationType ?? "RTA",
            productionStage: "CD",
            productionStartAt: target.productionStartAt ? dateOnly(target.productionStartAt) : null
          })
        });
        if (!productionRes.ok) {
          productionWarning = "Algunos estados se guardaron, pero no se pudo marcar toda la produccion en CD.";
          continue;
        }
        const productionData = await productionRes.json();
        nextRow = productionData.dispatch;
        patchDispatchLocally(nextRow);
      }
    }

    await loadDashboard();
    setBusy(false);
    if (failed) {
      setMessage(`${saved} guardadas. ${failed} no se pudieron guardar.`);
      return;
    }
    setMessage(productionWarning || (targetRows.length > 1 ? `${saved} tareas guardadas correctamente${completeProduction ? " con produccion en CD" : ""}.` : completeProduction ? "Guardado correctamente. Produccion marcada en CD." : "Guardado correctamente."));
  }

  async function saveProduction(row: DispatchRow, productionStage: string, fabricationType = row.fabricationType ?? "RTA", productionStartAt = row.productionStartAt ? dateOnly(row.productionStartAt) : "") {
    const targetRows = selectedRowsForAction(row);
    const compatibleRows = targetRows.filter((target) => productionRouteFor(target.id === row.id ? fabricationType : target.fabricationType).some((stage) => stage === productionStage));
    const skipped = targetRows.length - compatibleRows.length;

    await Promise.all(compatibleRows.map(async (target) => {
      const nextFabricationType = target.id === row.id ? fabricationType : target.fabricationType ?? "RTA";
      const nextProductionStartAt = target.id === row.id ? productionStartAt : target.productionStartAt ? dateOnly(target.productionStartAt) : "";
      const requestId = productionRequestSeq.current + 1;
      productionRequestSeq.current = requestId;
      const optimistic = {
        ...target,
        fabricationType: nextFabricationType,
        productionStage,
        productionStartAt: nextProductionStartAt || null
      } as DispatchRow;

      productionPendingRef.current[target.id] = { requestId, snapshot: target, optimistic };
      setProductionPendingIds((current) => Array.from(new Set([...current, target.id])));
      patchDispatchLocally(optimistic);

      try {
        const res = await fetch(`/api/dispatches/${target.id}/production`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ fabricationType: nextFabricationType, productionStage, productionStartAt: nextProductionStartAt || null })
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          if (productionPendingRef.current[target.id]?.requestId === requestId) {
            patchDispatchLocally(productionPendingRef.current[target.id].snapshot);
            delete productionPendingRef.current[target.id];
            setProductionPendingIds((current) => current.filter((id) => id !== target.id));
            setMessage(error.error ?? "No se pudo actualizar producción.");
          }
          return;
        }
        const data = await res.json();
        if (productionPendingRef.current[target.id]?.requestId === requestId) {
          patchDispatchLocally(data.dispatch);
          delete productionPendingRef.current[target.id];
          setProductionPendingIds((current) => current.filter((id) => id !== target.id));
          setMessage(skipped ? `${skipped} seleccionadas no usan esta etapa de produccion.` : "");
        }
      } catch {
        if (productionPendingRef.current[target.id]?.requestId === requestId) {
          patchDispatchLocally(productionPendingRef.current[target.id].snapshot);
          delete productionPendingRef.current[target.id];
          setProductionPendingIds((current) => current.filter((id) => id !== target.id));
          setMessage("No se pudo actualizar producción.");
        }
      }
    }));

    if (!compatibleRows.length && skipped) setMessage("Las tareas seleccionadas no usan esta etapa de produccion.");
  }

  async function importExcel(file: File) {
    setBusy(true);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let targetProgramId = activeProgram?.id ?? "";

    try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    targetProgramId = await ensureProgram();
    setImportStatus({ active: true, total: rows.length, processed: 0, created: 0, updated: 0, skipped: 0 });

    for (const [index, row] of rows.entries()) {
      const get = (...keys: string[]) => {
        const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const rowKeys = Object.keys(row);
        const found =
          rowKeys.find((key) => keys.some((candidate) => normalize(key) === normalize(candidate))) ??
          rowKeys.find((key) => keys.some((candidate) => normalize(key).includes(normalize(candidate))));
        return found ? String(row[found] ?? "").trim() : "";
      };
      const project = get("proyecto");
      const scheduledAt = get("fecha despacho", "fecha");
      const dispatchId = get("id", "dispatch id", "tarea id");
      if (!project || !scheduledAt) {
        skipped++;
        setImportStatus({ active: true, total: rows.length, processed: index + 1, created, updated, skipped });
        continue;
      }
      const date = spreadsheetDateOnly(scheduledAt);
      if (!date) {
        skipped++;
        setImportStatus({ active: true, total: rows.length, processed: index + 1, created, updated, skipped });
        continue;
      }
      const rawBusinessLine = get("linea negocio", "linea de negocio", "línea negocio", "línea de negocio");
      const businessLine = businessLines.find((line) => line.toLowerCase() === rawBusinessLine.toLowerCase()) ?? "Constructora";
      const rawProjectType = get("tipo proyecto", "tipo de proyecto", "clasificacion proyecto", "clasificación proyecto");
      const projectType = businessLine === "Constructora"
        ? projectTypes.find((type) => type.toLowerCase() === rawProjectType.toLowerCase()) ?? "Edificio"
        : "No aplica";
      const tower = get("torre");
      const core = get("nucleo", "nucleos", "núcleo", "núcleos");
      const floor = get("piso");
      const rawFabricationType = get("fabricacion", "fabricación", "tipo fabricacion", "tipo fabricación", "va armado", "rta");
      const fabricationType = rawFabricationType.toLowerCase().includes("armado") ? "ARMADO" : "RTA";
      const rawProductionStage = get("estado produccion", "estado producción", "etapa produccion", "etapa producción", "produccion", "producción");
      const productionStage = normalizeProductionStage(rawProductionStage);
      const productionStartAt = get("fecha ingreso produccion", "fecha ingreso producción", "ingreso produccion", "ingreso producción");
      const rawDispatchState = get("estado despacho", "estado entrega", "estado");
      const dispatchState = dispatchStateOptions.find((state) => state.toLowerCase() === rawDispatchState.toLowerCase()) ?? "";
      const actualDispatchAt = get("fecha real despacho", "fecha real entrega", "fecha real", "fecha despacho real");
      const dispatchNotes = get("notas despacho", "nota despacho", "notas estado", "nota estado");
      const description = businessLine === "Constructora" ? "" : get("descripcion", "descripción");
      const observation = get("observacion", "observación", "obs");
      const houseFromObservation = projectType === "Casas" ? observation.match(/^casas?\s+(.+)/i)?.[1]?.trim() ?? "" : "";
      const units = Number(get("deptos/casas", "depto/casa", "deptos", "depto", "casas", "casa", "unidades")) || 0;
      const body = JSON.stringify({
        businessLine,
        project: normalizeProjectName(project),
        projectType,
        type: get("tipo", "conjunto") || "COCINA",
        description: description || null,
        detail: houseFromObservation ? null : observation || null,
        tower: cleanLocationValue(tower, "torre") || null,
        core: cleanLocationValue(core, "nucleo") || null,
        floor: cleanLocationValue(floor || houseFromObservation, "piso") || null,
        fabricationType,
        productionStage,
        productionStartAt: productionStartAt ? spreadsheetDateOnly(productionStartAt) || null : null,
        units,
        scheduledAt: date,
        source: "excel"
      });
      const res = await fetch(dispatchId ? `/api/dispatches/${dispatchId}` : `/api/programs/${targetProgramId}/dispatches`, {
        method: dispatchId ? "PATCH" : "POST",
        headers,
        body
      });
      if (!res.ok) {
        skipped++;
        setImportStatus({ active: true, total: rows.length, processed: index + 1, created, updated, skipped });
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const savedDispatchId = dispatchId || data.dispatch?.id;
      if (dispatchState && savedDispatchId) {
        await fetch(`/api/dispatches/${savedDispatchId}/status`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            state: dispatchState,
            actualAt: actualDispatchAt ? spreadsheetDateOnly(actualDispatchAt) || null : null,
            notes: dispatchNotes
          })
        }).catch(() => undefined);
      }
      dispatchId ? updated++ : created++;
      setImportStatus({ active: true, total: rows.length, processed: index + 1, created, updated, skipped });
    }

    setBusy(false);
    setMessage(`Carga lista: ${created} nuevas, ${updated} actualizadas.${skipped ? ` ${skipped} filas omitidas o con error.` : ""}`);
    await loadDashboard(targetProgramId);
    setImportStatus({ active: false, total: rows.length, processed: rows.length, created, updated, skipped });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Error desconocido";
      setBusy(false);
      setImportStatus((current) => ({ ...current, active: true, error: detail }));
      setMessage(`No se pudo importar el Excel: ${detail}`);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.localStorage.removeItem("formatto-session");
    setSession(null);
  }

  if (!session) {
    return <LoginScreen onLogin={(nextSession) => { window.localStorage.setItem("formatto-session", JSON.stringify(nextSession)); setSession(nextSession); }} />;
  }

  return (
    <main className="formatto-shell md:pl-[58px]">
      <SideNav role={role} />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g2)] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <div className="h-8 w-px bg-[var(--g2)]" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--blk)]">Control de Entregas</div>
            <div className="text-[10px] text-[var(--mut)]">Tablero principal de control</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`thin-button inline-flex items-center justify-center p-2 ${role !== "admin" ? "opacity-50" : ""}`} title="Importar tareas desde Excel">
            <Upload size={16} />
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={role !== "admin"} onChange={(event) => event.target.files?.[0] && importExcel(event.target.files[0])} />
          </label>
          <Link className="thin-button inline-flex items-center justify-center p-2 no-underline" href="/diario" title="Reportes"><BarChart3 size={16} /></Link>
          {role === "admin" && <Link className="thin-button inline-flex items-center justify-center p-2 no-underline" href="/usuarios" title="Usuarios activos y roles"><Users size={16} /></Link>}
          {role === "admin" && <button className="thin-button inline-flex items-center justify-center p-2" onClick={() => setAuditModal(true)} title="Bitacora de cambios"><ClipboardList size={16} /></button>}
          <button className="thin-button inline-flex items-center justify-center p-2" onClick={() => loadDashboard()} title="Actualizar tablero"><RefreshCw size={16} /></button>
          <button className="thin-button inline-flex items-center gap-2" onClick={logout}><LogOut size={14} />{session.name}</button>
        </div>
      </header>

      {message && <div className="mx-6 mt-4 border-l-4 border-[var(--org)] bg-[#faece7] px-4 py-2 text-xs text-[#8b2500]">{message}</div>}
      {importStatus.active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-[420px] max-w-full border border-[var(--g2)] bg-white p-5 shadow-xl">
            <div className="mb-1 text-sm font-bold uppercase tracking-[0.06em]">Cargando datos</div>
            <div className="mb-4 text-xs text-[var(--mut)]">
              {importStatus.error ? "La carga se detuvo con error." : `Procesando ${importStatus.processed} de ${importStatus.total} filas.`}
            </div>
            <div className="mb-3 h-2 overflow-hidden bg-[var(--g2)]">
              <div className="h-full bg-[var(--org)]" style={{ width: `${importStatus.total ? Math.round((importStatus.processed / importStatus.total) * 100) : 8}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-[var(--g1)] p-2"><b>{importStatus.created}</b><br />Nuevas</div>
              <div className="bg-[var(--g1)] p-2"><b>{importStatus.updated}</b><br />Actualizadas</div>
              <div className="bg-[var(--g1)] p-2"><b>{importStatus.skipped}</b><br />Omitidas</div>
            </div>
            {importStatus.error && (
              <>
                <div className="mt-3 border-l-4 border-[var(--bad)] bg-[#fff7f5] p-2 text-xs text-[var(--bad)]">{importStatus.error}</div>
                <button className="thin-button mt-3 w-full" onClick={() => setImportStatus({ active: false, total: 0, processed: 0, created: 0, updated: 0, skipped: 0 })}>Cerrar</button>
              </>
            )}
          </div>
        </div>
      )}

      <section className="px-6 py-4">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-12">
          {[
            { label: "Total", value: summary.total },
            { label: "Proyectos", value: summary.projects },
            { label: "Despachados", value: summary.dispatched },
            { label: "Parciales", value: summary.partial },
            { label: "Cambios", value: summary.changes },
            { label: "Atraso", value: `${totalBuckets.lateRate}%`, count: totalBuckets.late },
            { label: "On time", value: `${totalBuckets.onTimeRate}%`, count: totalBuckets.onTime },
            { label: "Adelanto", value: `${totalBuckets.earlyRate}%`, count: totalBuckets.early },
            { label: "Pendiente", value: `${totalBuckets.pendingRate}%`, count: totalBuckets.pending },
            { label: "Producción", value: productionMetrics.inProduction },
            { label: "CD", value: productionMetrics.cd },
            { label: "Lead prod.", value: productionMetrics.averageLead === null ? "-" : `${productionMetrics.averageLead}d`, count: productionMetrics.withoutStart ? `${productionMetrics.withoutStart} sin ingreso` : undefined }
          ].map((item) => (
            <DashboardMetric key={item.label} label={item.label} value={item.value} count={item.count} />
          ))}
          </div>

          <div className="hidden">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Proyecto</label>
              <select className="field" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                {projects.map((project) => <option key={project} value={project}>{project === "todos" ? "Todos los proyectos" : project}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Categoría</label>
              <select className="field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="todos">Todas las categorías</option>
                {dispatchTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Estado</label>
              <select className="field" value={stateFilter} onChange={(event) => setStateFilter(event.target.value as DispatchState | "todos")}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="despachado">Despachado</option>
                <option value="cambio">Cambio</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Tiempo</label>
              <select className="field" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)}>
                <option value="todos">Todo el calendario</option>
                <option value="atrasadas">Atrasadas</option>
                <option value="hoy">Hoy</option>
                <option value="proximas">Próximos 7 días</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="thin-button h-[35px] w-full md:w-auto" onClick={() => { setTypeFilter("todos"); setProjectFilter("todos"); setStateFilter("todos"); setTimeFilter("todos"); }}>Limpiar</button>
            </div>
          </div>

          {selectedProjectPerformance && (
            <div className="hidden">
              <div className="md:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Comportamiento cliente/proyecto</div>
                <div className="text-base font-semibold">{selectedProjectPerformance.project}</div>
              </div>
              <Metric label="Despachado" value={`${selectedProjectPerformance.dispatched}/${selectedProjectPerformance.total}`} />
              <Metric label="Cumplimiento" value={`${selectedProjectPerformance.completion}%`} />
              <Metric label="A tiempo" value={`${selectedProjectPerformance.onTimeRate}%`} />
              <Metric label="Atraso" value={`${selectedProjectPerformance.lateRate}%`} />
              <Metric label="Adelanto" value={`${selectedProjectPerformance.earlyRate}%`} />
              <Metric label="Fallos atraso" value={selectedProjectPerformance.late} />
            </div>
          )}

          <FilterToolbar
            projects={projects}
            types={availableTypes}
            states={availableStates}
            businessLines={availableBusinessLines}
            businessLineFilter={businessLineFilter}
            typeFilter={typeFilter}
            stateFilter={stateFilter}
            projectFilter={projectFilter}
            timeFilter={timeFilter}
            search={search}
            projectSort={projectSort}
            onBusinessLineFilter={setBusinessLineFilter}
            onTypeFilter={setTypeFilter}
            onStateFilter={setStateFilter}
            onProjectFilter={setProjectFilter}
            onTimeFilter={setTimeFilter}
            onSearch={setSearch}
            onProjectSort={setProjectSort}
            onClearFilters={() => { setBusinessLineFilter("todos"); setTypeFilter("todos"); setProjectFilter("todos"); setStateFilter("todos"); setTimeFilter("todos"); setSearch(""); }}
          />

          {(showDispatch || showUrgent) && (
            <div className="mb-6 grid grid-cols-1 gap-4">
              {showDispatch && <TimelinePanel rows={timelineRows} offset={timelineOffset} onMove={setTimelineOffset} onSelect={setSelected} />}
              {showUrgent && <UrgentPanel items={urgentRows} onSelect={setSelected} />}
            </div>
          )}

          {showTasks && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-semibold">Panel de Control de Tareas</div>
              <div className="text-xs text-[var(--mut)]">{dispatches.length} tareas encontradas</div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <button className="primary-button inline-flex items-center gap-2" disabled={busy || role !== "admin"} onClick={() => setTaskModal({ mode: "create" })}><Plus size={14} />Agregar tarea</button>
              <button className="thin-button" onClick={collapseAllProjects}>Colapsar todo</button>
              <button className="thin-button" onClick={expandAllProjects}>Expandir todo</button>
            </div>
        </div>}

        {showTasks && <div className="grid gap-4 xl:grid-cols-[minmax(720px,1fr)_360px]">
          <div>
          {selectedProjectPerformance && (
            <div className="mb-3 grid grid-cols-2 gap-2 border border-[var(--g2)] bg-white p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Comportamiento cliente/proyecto</div>
                <div className="text-base font-semibold">{selectedProjectPerformance.project}</div>
              </div>
              <Metric label="Despachado" value={`${selectedProjectPerformance.dispatched}/${selectedProjectPerformance.total}`} />
              <Metric label="Cumplimiento" value={`${selectedProjectPerformance.completion}%`} />
              <Metric label="A tiempo" value={`${selectedProjectPerformance.onTimeRate}%`} />
              <Metric label="Atraso" value={`${selectedProjectPerformance.lateRate}%`} />
              <Metric label="Adelanto" value={`${selectedProjectPerformance.earlyRate}%`} />
              <Metric label="Fallos atraso" value={selectedProjectPerformance.late} />
            </div>
          )}
        <div className="overflow-x-auto border border-[var(--g2)]">
          <div className="min-w-[1240px] bg-white">
            <div className="grid grid-cols-[30px_minmax(92px,0.44fr)_190px_82px_82px_74px_minmax(390px,1fr)_34px] border-b border-[var(--g2)] bg-[var(--blk)] px-2 py-1.5 text-[9px] uppercase tracking-[0.06em] text-white">
              <button className="text-left" onClick={toggleAllVisible}>Sel</button>
              <div>Entrega</div><div>Ubicación</div><div>Programación</div><div>Resultado</div><div>Estado</div><div className="border-l-2 border-white/60 pl-3">Producción</div><div></div>
            </div>
            {groupedByBusinessLine.map((section) => (
              <div key={section.line}>
                <div className="border-t border-[var(--g2)] bg-[var(--g1)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--blk)]">
                  {section.line.toUpperCase()}
                </div>
                {section.groups.map((group) => (
                  <div key={`${section.line}-${group.project}`} className="border-b border-[var(--g2)]">
                    <ProjectGroupHeader
                      group={group}
                      collapsed={collapsedProjects.includes(group.project)}
                      allSelected={group.rows.every((row) => checked.includes(row.id))}
                      onToggle={() => toggleProject(group.project)}
                      onSelectAll={() => toggleProjectSelection(group.rows)}
                    />
                    {!collapsedProjects.includes(group.project) && group.rows.map((row) => {
                      const state = row.status?.state ?? "pendiente";
                      const time = timeState(row);
                      const rowTone =
                        state !== "despachado" && time.value > 0 ? "bg-[#fff7f5]" :
                        state !== "despachado" && time.value === 0 ? "bg-[#fffaf0]" :
                        state === "despachado" ? "opacity-70" : "";
                      const resultDiff = row.status?.actualAt ? businessDiffDays(row.scheduledAt, row.status.actualAt) : null;
                      return (
                        <div key={row.id} className={`grid grid-cols-[30px_minmax(92px,0.44fr)_190px_82px_82px_74px_minmax(390px,1fr)_34px] items-stretch border-t border-[var(--g2)] px-2 py-2 text-left text-[11px] leading-tight hover:bg-[var(--g1)] ${rowTone}`}>
                          <input className="h-3 w-3 accent-[var(--org)]" type="checkbox" checked={checked.includes(row.id)} onChange={() => toggleChecked(row.id)} aria-label={`Seleccionar ${row.project}`} />
                          <button className="min-w-0 text-left" onClick={() => setSelected(row)}>
                            <div className="font-semibold">{row.type}</div>
                            <div className="whitespace-normal break-words text-[10px] leading-snug text-[var(--mut)]">{dispatchObservation(row)}</div>
                          </button>
                        <button className={locationCellClass(row)} onClick={() => setSelected(row)}>
                          <div className={quantityClass(row)}>{primaryLocationLabel(row)}</div>
                          {secondaryLocationLabel(row) && <div className="whitespace-normal break-words text-[10px] leading-snug text-[var(--mut)]">{secondaryLocationLabel(row)}</div>}
                        </button>
                          <button className="text-left" onClick={() => setSelected(row)}>
                            <div className="font-semibold">{shortDate(row.scheduledAt)}</div>
                            <div className={`text-[10px] ${time.tone}`}>{time.label}</div>
                          </button>
                          <button className="text-left" onClick={() => setSelected(row)}>
                            <div className="font-semibold">{shortDate(row.status?.actualAt)}</div>
                            <div className="text-[10px] text-[var(--mut)]">
                              {resultDiff === null ? "Sin resultado" : resultDiff === 0 ? "En fecha" : resultDiff > 0 ? `+${resultDiff}d` : `${resultDiff}d`}
                            </div>
                          </button>
                          <div><span className={`status-badge ${statusClass(state)}`}>{state}</span></div>
                          <div className="min-w-0 border-l-2 border-[#9a9a9a] bg-white/70 py-1 pl-3 pr-2 text-left">
                            <ProductionProgress row={row} compact saving={productionPendingIds.includes(row.id)} disabled={role === "lector"} onStageChange={(stage) => saveProduction(row, stage)} />
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--mut)]">
                              <span>Ingreso {shortDate(row.productionStartAt)}</span>
                              <span className={productionWindow(row).tone}>{productionWindow(row).label}</span>
                            </div>
                          </div>
                          <button className="thin-button p-2" disabled={role !== "admin"} onClick={() => setTaskModal({ mode: "edit", row })} title="Editar tarea"><Edit3 size={13} /></button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
          </div>
          <OperationsSummaryPanel
            groups={groupedDispatches}
            rows={dispatches}
            projects={projects}
            businessLines={availableBusinessLines}
            businessLineFilter={businessLineFilter}
            typeFilter={typeFilter}
            stateFilter={stateFilter}
            projectFilter={projectFilter}
            timeFilter={timeFilter}
            onBusinessLineFilter={setBusinessLineFilter}
            onTypeFilter={setTypeFilter}
            onStateFilter={setStateFilter}
            onProjectFilter={setProjectFilter}
            onTimeFilter={setTimeFilter}
            onClearFilters={() => { setBusinessLineFilter("todos"); setTypeFilter("todos"); setProjectFilter("todos"); setStateFilter("todos"); setTimeFilter("todos"); setSearch(""); }}
            search={search}
            onSearch={setSearch}
            projectSort={projectSort}
            onProjectSort={setProjectSort}
            onProject={(project) => setProjectFilter((current) => current === project ? "todos" : project)}
            onSelect={setSelected}
          />
        </div>}
      </section>

      {selected && (
        <StatusModal
          row={selected}
          role={role}
          busy={busy}
          productionSaving={productionPendingIds.includes(selected.id)}
          message={/Guardado|No se pudo guardar|produccion/i.test(message) ? message : ""}
          onClose={() => setSelected(null)}
          onEdit={() => { setSelected(null); setTaskModal({ mode: "edit", row: selected }); }}
          onDelete={() => deleteTask(selected)}
          onSave={saveStatus}
          onProductionSave={saveProduction}
        />
      )}

      {taskModal && (
        <TaskModal
          row={taskModal.row}
          role={role}
          busy={busy}
          onClose={() => setTaskModal(null)}
          onSave={(draft) => saveTask(draft, taskModal.row)}
        />
      )}

      {auditModal && <AuditModal headers={headers} onClose={() => setAuditModal(false)} />}
    </main>
  );
}

export default function Home() {
  return <DashboardApp defaultView="dashboard" />;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    setBusy(false);
    if (!res.ok) {
      setError("Credenciales invalidas.");
      return;
    }
    const data = await res.json();
    onLogin(data.user);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--g1)] p-6">
      <section className="w-[390px] border border-[var(--g2)] bg-white p-8">
        <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
        <h1 className="mt-8 text-lg font-bold uppercase tracking-[0.06em]">Control de Entregas</h1>
        <p className="mb-6 text-xs text-[var(--mut)]">Tablero principal de control</p>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Email</label>
        <input className="field mb-3" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Clave</label>
        <div className="mb-4 flex items-center border border-[var(--g2)] bg-white focus-within:border-[var(--blk)]">
          <input
            className="h-[35px] flex-1 border-0 px-3 text-sm outline-none"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
          <button
            className="flex h-[35px] w-[38px] items-center justify-center border-l border-[var(--g2)] text-[var(--mut)] hover:text-[var(--blk)]"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            title={showPassword ? "Ocultar clave" : "Mostrar clave"}
            aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <div className="mb-3 border-l-4 border-[var(--org)] bg-[#faece7] p-2 text-xs text-[#8b2500]">{error}</div>}
        <button className="primary-button w-full" disabled={busy} onClick={submit}>Ingresar</button>
      </section>
    </main>
  );
}

function DashboardMetric({ label, value, count }: { label: string; value: string | number; count?: string | number }) {
  return (
    <div className="border border-[var(--g2)] border-t-[3px] border-t-[var(--org)] bg-white p-3">
      <div className="text-[9px] uppercase tracking-[0.07em] text-[var(--mut)]">{label}</div>
      <div className="mt-1 text-2xl font-light text-[var(--blk)]">{value}</div>
      {typeof count === "number" && <div className="mt-1 text-[10px] text-[var(--mut)]">{count} tareas</div>}
    </div>
  );
}

function emptyUserDraft(): UserDraft {
  return {
    email: "",
    fullName: "",
    role: "lector",
    area: "Planificacion y Adquisiciones",
    position: "",
    password: "",
    active: true
  };
}

function UsersModal({
  headers,
  busy,
  setBusy,
  onMessage,
  onClose
}: {
  headers: Record<string, string>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onMessage: (message: string) => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceRow[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [draft, setDraft] = useState<UserDraft>(emptyUserDraft());
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [createdPassword, setCreatedPassword] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    const [res, presenceRes] = await Promise.all([
      fetch("/api/users", { headers }),
      fetch("/api/presence", { headers })
    ]);
    if (!res.ok) {
      setError("No se pudieron cargar los usuarios.");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setAreas(data.areas ?? []);
    if (presenceRes.ok) {
      const presenceData = await presenceRes.json();
      setOnlineUsers(presenceData.users ?? []);
    }
  }, [headers]);

  useEffect(() => {
    loadUsers().catch(() => setError("No se pudieron cargar los usuarios."));
  }, [loadUsers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadUsers().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadUsers]);

  function editUser(user: UserRow) {
    setEditing(user);
    setCreatedPassword("");
    setDraft({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      area: user.area ?? "Planificacion y Adquisiciones",
      position: user.position ?? "",
      password: "",
      active: user.active
    });
  }

  function resetForm() {
    setEditing(null);
    setDraft(emptyUserDraft());
    setCreatedPassword("");
    setError("");
  }

  async function saveUser() {
    setBusy(true);
    setError("");
    setCreatedPassword("");
    const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
      method: editing ? "PATCH" : "POST",
      headers,
      body: JSON.stringify({
        email: draft.email,
        fullName: draft.fullName,
        role: draft.role,
        area: draft.area,
        position: draft.position,
        password: draft.password || null,
        active: draft.active
      })
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar el usuario. Revisa duplicados y campos obligatorios.");
      return;
    }
    if (data.initialPassword) setCreatedPassword(data.initialPassword);
    onMessage(editing ? "Usuario actualizado." : "Usuario creado.");
    resetForm();
    await loadUsers();
  }

  async function deactivateUser(user: UserRow) {
    if (!confirm(`Desactivar usuario ${user.email}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE", headers });
    setBusy(false);
    if (!res.ok) {
      setError("No se pudo desactivar el usuario.");
      return;
    }
    onMessage("Usuario desactivado.");
    await loadUsers();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <section className="mt-8 w-full max-w-6xl border border-[var(--g2)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--g2)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]">Usuarios y roles</h2>
            <p className="text-xs text-[var(--mut)]">Administra accesos, areas y claves iniciales.</p>
          </div>
          <button className="thin-button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[360px_1fr]">
          <div className="border border-[var(--g2)] p-4">
            <div className="mb-4 border border-[var(--g2)] bg-[var(--g1)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em]"><Activity size={14} />Usuarios activos</div>
              <div className="space-y-2">
                {onlineUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="font-semibold">{user.fullName}</div>
                      <div className="text-[10px] text-[var(--mut)]">{user.lastActivity ?? "Activo"} · {shortDate(user.lastSeenAt)}</div>
                    </div>
                    <span className="status-badge status-despachado">online</span>
                  </div>
                ))}
                {onlineUsers.length === 0 && <div className="text-xs text-[var(--mut)]">Sin usuarios activos en los ultimos minutos.</div>}
              </div>
            </div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.06em]">{editing ? "Editar usuario" : "Nuevo usuario"}</div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Nombre</label>
            <input className="field mb-2" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Email</label>
            <input className="field mb-2" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Area</label>
            <select className="field mb-2" value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })}>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Cargo</label>
            <input className="field mb-2" value={draft.position} onChange={(event) => setDraft({ ...draft, position: event.target.value })} />
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Rol</label>
            <select className="field mb-2" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>
              <option value="admin">Admin</option>
              <option value="operador">Operador</option>
              <option value="lector">Lector</option>
            </select>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Clave {editing ? "nueva opcional" : "opcional"}</label>
            <input className="field mb-2" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Vacio: genera por area" />
            <label className="mb-4 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Usuario activo
            </label>
            {createdPassword && <div className="mb-3 border-l-4 border-[var(--ok)] bg-[#eef8f1] p-2 text-xs">Clave inicial generada: <strong>{createdPassword}</strong></div>}
            {error && <div className="mb-3 border-l-4 border-[var(--org)] bg-[#faece7] p-2 text-xs text-[#8b2500]">{error}</div>}
            <div className="flex gap-2">
              <button className="primary-button" disabled={busy} onClick={saveUser}><Save size={14} /> Guardar</button>
              <button className="thin-button" onClick={resetForm}>Limpiar</button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[var(--g2)]">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.2fr_1.2fr_120px_120px_90px_120px] bg-[var(--blk)] px-3 py-2 text-[9px] uppercase tracking-[0.06em] text-white">
                <div>Usuario</div><div>Area</div><div>Cargo</div><div>Rol</div><div>Estado</div><div></div>
              </div>
              {users.map((user) => (
                <div key={user.id} className="grid grid-cols-[1.2fr_1.2fr_120px_120px_90px_120px] items-center border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                  <div>
                    <div className="font-semibold">{user.fullName}</div>
                    <div className="text-[10px] text-[var(--mut)]">{user.email}</div>
                  </div>
                  <div>{user.area ?? "-"}</div>
                  <div className="truncate">{user.position ?? "-"}</div>
                  <div><span className="status-badge status-pendiente">{user.role}</span></div>
                  <div>{user.active ? "Activo" : "Inactivo"}</div>
                  <div className="flex justify-end gap-2">
                    <button className="thin-button p-2" onClick={() => editUser(user)} title="Editar usuario"><Edit3 size={13} /></button>
                    <button className="thin-button p-2" disabled={!user.active} onClick={() => deactivateUser(user)} title="Desactivar usuario"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div className="p-4 text-xs text-[var(--mut)]">Sin usuarios creados.</div>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditModal({ headers, onClose }: { headers: Record<string, string>; onClose: () => void }) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");

  const loadAudit = useCallback(async () => {
    const params = new URLSearchParams();
    if (userFilter.trim()) params.set("user", userFilter.trim());
    if (actionFilter !== "todos") params.set("action", actionFilter);
    if (dateFilter) params.set("date", dateFilter);
    const res = await fetch(`/api/audit?${params.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo cargar la bitacora.");
      return;
    }
    setLogs(data.logs ?? []);
    setError("");
  }, [actionFilter, dateFilter, headers, userFilter]);

  useEffect(() => {
    loadAudit().catch(() => setError("No se pudo cargar la bitacora."));
  }, [loadAudit]);

  const actions = Array.from(new Set(logs.map((log) => log.action))).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <section className="mt-8 w-full max-w-6xl border border-[var(--g2)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--g2)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]">Bitacora de cambios</h2>
            <p className="text-xs text-[var(--mut)]">Registro administrativo de creaciones, ediciones, eliminaciones y cambios de estado.</p>
          </div>
          <button className="thin-button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="grid gap-3 border-b border-[var(--g2)] p-4 md:grid-cols-[1fr_180px_160px_auto]">
          <input className="field" value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="Filtrar por usuario" />
          <select className="field" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="todos">Todas las acciones</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <input className="field" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <button className="thin-button inline-flex items-center gap-2" onClick={loadAudit}><RefreshCw size={14} />Actualizar</button>
        </div>
        {error && <div className="m-4 border-l-4 border-[var(--org)] bg-[#faece7] p-2 text-xs text-[#8b2500]">{error}</div>}
        <div className="overflow-x-auto p-4">
          <div className="min-w-[860px] border border-[var(--g2)]">
            <div className="grid grid-cols-[150px_1.1fr_150px_130px_1.5fr] bg-[var(--blk)] px-3 py-2 text-[9px] uppercase tracking-[0.06em] text-white">
              <div>Fecha</div><div>Usuario</div><div>Accion</div><div>Entidad</div><div>Detalle</div>
            </div>
            {logs.map((log) => (
              <div key={log.id} className="grid grid-cols-[150px_1.1fr_150px_130px_1.5fr] border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                <div>{shortDate(log.createdAt)}</div>
                <div className="truncate">{log.actorEmail}</div>
                <div><span className="status-badge status-pendiente">{log.action}</span></div>
                <div>{log.entity}</div>
                <div className="truncate">{log.summary}</div>
              </div>
            ))}
            {logs.length === 0 && <div className="p-4 text-xs text-[var(--mut)]">Sin eventos registrados para los filtros actuales.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-l-2 border-[var(--org)] bg-[var(--g1)] px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--mut)]">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function FilterToolbar({
  projects,
  types,
  states,
  businessLines,
  businessLineFilter,
  typeFilter,
  stateFilter,
  projectFilter,
  timeFilter,
  search,
  projectSort,
  onBusinessLineFilter,
  onTypeFilter,
  onStateFilter,
  onProjectFilter,
  onTimeFilter,
  onSearch,
  onProjectSort,
  onClearFilters
}: {
  projects: string[];
  types: string[];
  states: Array<DispatchState | "todos">;
  businessLines: string[];
  businessLineFilter: string;
  typeFilter: string;
  stateFilter: DispatchState | "todos";
  projectFilter: string;
  timeFilter: "todos" | "atrasadas" | "hoy" | "proximas";
  search: string;
  projectSort: "prioridad" | "atraso" | "cumplimiento" | "nombre";
  onBusinessLineFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStateFilter: (value: DispatchState | "todos") => void;
  onProjectFilter: (value: string) => void;
  onTimeFilter: (value: "todos" | "atrasadas" | "hoy" | "proximas") => void;
  onSearch: (value: string) => void;
  onProjectSort: (value: "prioridad" | "atraso" | "cumplimiento" | "nombre") => void;
  onClearFilters: () => void;
}) {
  const fieldWrap = "flex min-w-[150px] flex-1 items-center gap-2 border border-[var(--g2)] bg-white px-2 py-1.5";
  const iconClass = "shrink-0 text-[var(--org)]";
  const selectClass = "min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[var(--blk)] outline-none";
  const inputClass = "min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[var(--blk)] outline-none";

  return (
    <div className="mb-4 border border-[var(--g2)] bg-[var(--g1)] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[210px] flex-[1.4] items-center gap-2 border border-[var(--g2)] bg-white px-2 py-1.5">
          <Search size={15} className={iconClass} />
          <input className={inputClass} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar proyecto, conjunto, piso..." />
        </div>
        <label className={fieldWrap} title="Linea de negocio">
          <Building2 size={15} className={iconClass} />
          <select className={selectClass} value={businessLineFilter} onChange={(event) => onBusinessLineFilter(event.target.value)}>
            {businessLines.map((line) => <option key={line} value={line}>{line === "todos" ? "Todas las lineas" : line}</option>)}
          </select>
        </label>
        <label className={fieldWrap} title="Proyecto">
          <FolderKanban size={15} className={iconClass} />
          <select className={selectClass} value={projectFilter} onChange={(event) => onProjectFilter(event.target.value)}>
            {projects.map((project) => <option key={project} value={project}>{project === "todos" ? "Todos los proyectos" : project}</option>)}
          </select>
        </label>
        <label className={fieldWrap} title="Conjunto">
          <Layers size={15} className={iconClass} />
          <select className={selectClass} value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)}>
            <option value="todos">Todos los conjuntos</option>
            {types.filter((type) => type !== "todos").map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className={fieldWrap} title="Estado despacho">
          <ListFilter size={15} className={iconClass} />
          <select className={selectClass} value={stateFilter} onChange={(event) => onStateFilter(event.target.value as DispatchState | "todos")}>
            <option value="todos">Todos los estados</option>
            {states.filter((state) => state !== "todos").map((state) => <option key={state} value={state}>{state === "pendiente" ? "Pendiente" : state === "parcial" ? "Parcial" : state === "despachado" ? "Despachado" : "Cambio"}</option>)}
          </select>
        </label>
        <label className={fieldWrap} title="Tiempo">
          <CalendarClock size={15} className={iconClass} />
          <select className={selectClass} value={timeFilter} onChange={(event) => onTimeFilter(event.target.value as "todos" | "atrasadas" | "hoy" | "proximas")}>
            <option value="todos">Todo calendario</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="hoy">Hoy</option>
            <option value="proximas">Proximas 7 dias</option>
          </select>
        </label>
        <label className={fieldWrap} title="Orden">
          <SlidersHorizontal size={15} className={iconClass} />
          <select className={selectClass} value={projectSort} onChange={(event) => onProjectSort(event.target.value as "prioridad" | "atraso" | "cumplimiento" | "nombre")}>
            <option value="prioridad">Prioridad</option>
            <option value="atraso">Atraso</option>
            <option value="cumplimiento">Cumplimiento</option>
            <option value="nombre">A-Z</option>
          </select>
        </label>
        <button className="thin-button inline-flex items-center justify-center p-2" onClick={onClearFilters} title="Limpiar filtros">
          <FilterX size={15} />
        </button>
      </div>
    </div>
  );
}

function OperationsSummaryPanel({
  groups,
  rows,
  projects,
  businessLines,
  businessLineFilter,
  typeFilter,
  stateFilter,
  projectFilter,
  timeFilter,
  onBusinessLineFilter,
  onTypeFilter,
  onStateFilter,
  onProjectFilter,
  onTimeFilter,
  onClearFilters,
  search,
  onSearch,
  projectSort,
  onProjectSort,
  onProject,
  onSelect
}: {
  groups: Array<{
    project: string;
    rows: DispatchRow[];
    performance?: {
      total: number;
      dispatched: number;
      completion: number;
      onTimeRate: number;
      lateRate: number;
      earlyRate: number;
      late: number;
    };
    pendingCritical: number;
    delayedTasks: number;
    upcomingTasks: number;
    maxDelay: number;
  }>;
  rows: DispatchRow[];
  projects: string[];
  businessLines: string[];
  businessLineFilter: string;
  typeFilter: string;
  stateFilter: DispatchState | "todos";
  projectFilter: string;
  timeFilter: "todos" | "atrasadas" | "hoy" | "proximas";
  onBusinessLineFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStateFilter: (value: DispatchState | "todos") => void;
  onProjectFilter: (value: string) => void;
  onTimeFilter: (value: "todos" | "atrasadas" | "hoy" | "proximas") => void;
  onClearFilters: () => void;
  search: string;
  onSearch: (value: string) => void;
  projectSort: "prioridad" | "atraso" | "cumplimiento" | "nombre";
  onProjectSort: (value: "prioridad" | "atraso" | "cumplimiento" | "nombre") => void;
  onProject: (project: string) => void;
  onSelect: (row: DispatchRow) => void;
}) {
  const pending = rows.filter((row) => (row.status?.state ?? "pendiente") !== "despachado");
  const dispatched = rows.filter((row) => (row.status?.state ?? "pendiente") === "despachado");
  const lateDispatched = dispatched.filter((row) => timeState(row).value > 0).slice(0, 5);
  const criticalAll = pending.filter((row) => timeState(row).value >= 0);
  const critical = criticalAll.slice(0, 6);
  const focusProjects = groups;
  const focusByBusinessLine = businessLines
    .filter((line) => line !== "todos")
    .map((line) => ({
      line,
      groups: focusProjects.filter((group) => (group.rows[0]?.businessLine ?? "Constructora") === line)
    }))
    .filter((section) => section.groups.length > 0);
  const toggleState = (state: DispatchState) => onStateFilter(stateFilter === state ? "todos" : state);
  const toggleLate = () => {
    onTimeFilter(timeFilter === "atrasadas" ? "todos" : "atrasadas");
    onStateFilter("todos");
  };
  const projectTone = (group: typeof groups[number]) => {
    const lateRate = group.performance?.lateRate ?? 0;
    const earlyRate = group.performance?.earlyRate ?? 0;
    const onTimeRate = group.performance?.onTimeRate ?? 0;
    if (projectFilter === group.project) return "border-l-[var(--bad)] bg-[#faece7]";
    if (group.delayedTasks > 0) return "border-l-[var(--bad)] bg-[#fff7f5]";
    if (group.upcomingTasks > 0) return "border-l-[#55555099] bg-white";
    if (earlyRate > 0) return "border-l-[#e9a82580] bg-white";
    if (onTimeRate > 0) return "border-l-[#2d7a3a80] bg-white";
    if (lateRate > 0) return "border-l-[var(--bad)] bg-[#fff7f5]";
    return "border-l-[var(--g2)] bg-white";
  };

  return (
    <aside className="space-y-3">
      <section className="border border-[var(--g2)] bg-white p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Resumen operativo</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="text-left" onClick={() => toggleState("pendiente")} title="Ver pendientes en la tabla"><Metric label="Pendientes" value={pending.length} /></button>
          <button className="text-left" onClick={() => toggleState("despachado")} title="Ver despachadas en la tabla"><Metric label="Despachadas" value={dispatched.length} /></button>
          <button className="text-left" onClick={toggleLate} title="Ver criticas en la tabla"><Metric label="Criticas" value={criticalAll.length} /></button>
          <button className="text-left" onClick={() => onProjectFilter("todos")} title="Ver todos los proyectos"><Metric label="Proyectos" value={groups.length} /></button>
        </div>
      </section>
      <section className="border border-[var(--g2)] bg-white p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Foco por proyecto</div>
        <div className="space-y-3">
          {focusByBusinessLine.map((section) => (
            <div key={section.line}>
              <div className="mb-1 border-l-2 border-[var(--org)] pl-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--mut)]">{section.line}</div>
              <div className="space-y-2">
                {section.groups.map((group) => (
                  <button key={group.project} className={`w-full border-l-4 p-2 text-left hover:bg-[#faece7] ${projectTone(group)}`} onClick={() => onProject(group.project)} title={projectFilter === group.project ? "Quitar foco del proyecto" : "Filtrar por proyecto"}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold">{group.project}</span>
                      <span className="text-[10px] text-[var(--mut)]">{projectFilter === group.project ? "activo" : `${group.performance?.completion ?? 0}%`}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--mut)]">
                      {group.performance ? `${group.performance.dispatched}/${group.performance.total} desp.` : `${group.rows.length} tareas`}
                      {group.delayedTasks ? ` · ${group.delayedTasks} atraso` : ""}
                      {group.pendingCritical ? ` · ${group.pendingCritical} críticas` : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="border border-[var(--g2)] bg-white p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Tareas criticas abiertas</div>
        <div className="space-y-2">
          {critical.map((row) => (
            <button key={row.id} className="w-full bg-[#fff7f5] p-2 text-left hover:bg-[#faece7]" onClick={() => onSelect(row)}>
              <div className="truncate text-xs font-bold">{row.project}</div>
              <div className="truncate text-[10px] text-[var(--mut)]">{row.type} · {displayDispatchDetail(row)}</div>
              <div className={`text-[10px] ${timeState(row).tone}`}>{timeState(row).label}</div>
            </button>
          ))}
          {critical.length === 0 && <div className="text-xs text-[var(--mut)]">Sin tareas criticas abiertas.</div>}
        </div>
      </section>
      <section className="hidden">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Despachadas con atraso</div>
        <div className="space-y-2">
          {lateDispatched.map((row) => (
            <button key={row.id} className="w-full bg-white p-2 text-left ring-1 ring-[var(--g2)] hover:bg-[var(--g1)]" onClick={() => onSelect(row)}>
              <div className="truncate text-xs font-bold">{row.project}</div>
              <div className="truncate text-[10px] text-[var(--mut)]">{row.type} · {displayDispatchDetail(row)}</div>
              <div className="text-[10px] text-[var(--bad)]">{timeState(row).label}</div>
            </button>
          ))}
          {lateDispatched.length === 0 && <div className="text-xs text-[var(--mut)]">Sin despachos cerrados con atraso.</div>}
        </div>
      </section>
    </aside>
  );
}

function ProjectGroupHeader({ group, collapsed, allSelected, onToggle, onSelectAll }: {
  group: {
    project: string;
    rows: DispatchRow[];
    performance?: {
      total: number;
      dispatched: number;
      completion: number;
      onTimeRate: number;
      lateRate: number;
      earlyRate: number;
      late: number;
    };
    pendingCritical: number;
    delayedTasks: number;
    upcomingTasks: number;
    maxDelay: number;
  };
  collapsed: boolean;
  allSelected: boolean;
  onToggle: () => void;
  onSelectAll: () => void;
}) {
  const performance = group.performance;
  const completion = performance?.completion ?? 0;
  const lateRate = performance?.lateRate ?? 0;
  const earlyRate = performance?.earlyRate ?? 0;
  const onTimeRate = performance?.onTimeRate ?? 0;
  const dominant =
    group.delayedTasks > 0 ? "atraso" :
    group.upcomingTasks > 0 ? "proximo" :
    earlyRate > 0 ? "adelanto" :
    onTimeRate > 0 ? "ontime" : "neutro";
  const dominantClass =
    dominant === "atraso" ? "border-l-[var(--bad)] bg-[#fff7f5]" :
    dominant === "proximo" ? "border-l-[#55555099] bg-white" :
    dominant === "adelanto" ? "border-l-[#e9a82580] bg-white" :
    dominant === "ontime" ? "border-l-[#2d7a3a80] bg-white" :
    "border-l-[var(--g2)] bg-white";

  return (
    <div className={`border-l-4 px-2 py-2 ${dominantClass}`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="thin-button px-2 py-1" onClick={onToggle} title={collapsed ? "Expandir proyecto" : "Colapsar proyecto"}>{collapsed ? "+" : "-"}</button>
          <input className="h-3 w-3 accent-[var(--org)]" type="checkbox" checked={allSelected} onChange={onSelectAll} aria-label={`Seleccionar tareas de ${group.project}`} />
          <div>
          <div className="text-sm font-bold leading-tight">{group.project}</div>
          <div className="text-[10px] text-[var(--mut)]">
            {performance ? `${performance.dispatched}/${performance.total} despachadas` : `${group.rows.length} tareas`}
            {group.pendingCritical > 0 ? ` · ${group.pendingCritical} críticas` : ""}
            {group.delayedTasks > 0 ? ` · ${group.delayedTasks} con atraso` : ""}
            {group.maxDelay > 0 ? ` · max ${group.maxDelay}d atraso` : ""}
          </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="status-badge status-pendiente">Cumpl. {completion}%</span>
          <span className="status-badge bg-[#eef7f0cc] text-[var(--ok)]">On time {onTimeRate}%</span>
          <span className="status-badge bg-[#fff6dacc] text-[#8a6500]">Adel. {earlyRate}%</span>
          <span className="status-badge status-cambio">Atraso {lateRate}%</span>
        </div>
      </div>
      <div className="flex h-1.5 overflow-hidden bg-[var(--g1)]">
        {group.delayedTasks > 0 ? (
          <div className="bg-[var(--bad)]" style={{ width: "100%" }} />
        ) : group.upcomingTasks > 0 ? (
          <div className="bg-[#55555066]" style={{ width: "100%" }} />
        ) : (
          <>
            <div className="bg-[#2d7a3a80]" style={{ width: `${onTimeRate}%` }} />
            <div className="bg-[#e9a82580]" style={{ width: `${earlyRate}%` }} />
            <div className="bg-[var(--bad)]" style={{ width: `${lateRate}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

function TimelinePanel({ rows, offset, onMove, onSelect }: {
  rows: DispatchRow[];
  offset: number;
  onMove: (offset: number) => void;
  onSelect: (row: DispatchRow) => void;
}) {
  const today = todayOnly();
  const sectionRef = useRef<HTMLElement | null>(null);
  const days = useMemo(() => {
    const center = addBusinessDays(today, offset);
    return Array.from({ length: 9 }, (_, index) => addBusinessDays(center, index - 4));
  }, [offset, today]);
  const rowsByDay = useMemo(() => {
    const map = new Map<string, DispatchRow[]>();
    rows.forEach((row) => {
      const key = dateOnly(row.scheduledAt);
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    return map;
  }, [rows]);
  const settleTimeline = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section ref={sectionRef} className="border border-[var(--g2)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-base font-semibold">Panel de Control de Despacho</div>
          <div className="text-xs text-[var(--mut)]">4 días atrás · hoy · 4 días adelante</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="thin-button" onClick={() => onMove(offset - 9)}>Anterior</button>
          <button className="thin-button active" onClick={() => onMove(0)}>Hoy</button>
          <button className="thin-button" onClick={() => onMove(offset + 9)}>Siguiente</button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="relative grid min-w-[1080px] grid-cols-9 gap-2 pb-5 pt-2">
          <div className="absolute left-0 right-0 top-[44px] h-px bg-[var(--g2)]" />
          {days.map((day) => {
            const dayRows = (rowsByDay.get(day) ?? []).slice().sort((a, b) => {
              const ta = timeState(a);
              const tb = timeState(b);
              return tb.value - ta.value || a.project.localeCompare(b.project);
            });
            const isToday = day === today;
            return (
              <div key={day} className="relative min-w-0 text-left">
                <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center border bg-white text-[10px] font-bold ${isToday ? "border-[var(--org)] text-[var(--org)]" : "border-[var(--g2)] text-[var(--blk)]"}`}>
                  {shortDate(day).replace(".", "")}
                </div>
                {isToday && <div className="mb-2 text-center"><span className="status-badge status-cambio">Hoy</span></div>}
                <div className={`flex min-h-[112px] flex-col gap-1.5 border p-2 ${isToday ? "border-[var(--org)] bg-[#fff7f5]" : "border-[var(--g2)] bg-[var(--g1)]"}`}>
                  {dayRows.length === 0 && <div className="pt-8 text-center text-[9px] text-[var(--mut)]">Sin entregas</div>}
                  {dayRows.map((row) => {
                    const time = timeState(row);
                    return (
                      <button key={row.id} className="bg-white px-2 py-1 text-left shadow-sm hover:outline hover:outline-1 hover:outline-[var(--org)]" onClick={() => onSelect(row)}>
                        <div className="truncate text-[10px] font-bold text-[var(--org)]">{row.project}</div>
                        <div className="truncate text-[9px] text-[var(--mut)]">{row.type} · {displayDispatchDetail(row)}</div>
                        <div className={`text-[9px] ${time.tone}`}>{time.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid gap-2 border-t border-[var(--g2)] pt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--mut)]">
          <span>-36 dias</span>
          <span>{offset === 0 ? "Hoy" : offset < 0 ? `${Math.abs(offset)} dias atras` : `${offset} dias adelante`}</span>
          <span>+36 dias</span>
        </div>
        <input
          className="w-full accent-[var(--org)]"
          type="range"
          min="-36"
          max="36"
          step="1"
          value={offset}
          onChange={(event) => onMove(Number(event.target.value))}
          onMouseUp={settleTimeline}
          onTouchEnd={settleTimeline}
          onKeyUp={settleTimeline}
          aria-label="Mover rango de dias del panel de despacho"
        />
      </div>
      <div className="mt-1 border-t border-[var(--g2)] pt-3 text-[10px] text-[var(--mut)]">Hoy fijado: {shortDate(today)}. Si hay mas de una entrega por dia, se apilan hacia abajo.</div>
    </section>
  );
}

function UrgentPanel({ items, onSelect }: { items: Array<{ row: DispatchRow; time: ReturnType<typeof timeState> }>; onSelect: (row: DispatchRow) => void }) {
  return (
    <section className="border border-[var(--g2)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-base font-semibold">Panel de Entregas Urgentes</div>
        <span className="status-badge status-cambio">{items.length}</span>
      </div>
      <div className="grid max-h-[260px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 && <div className="text-xs text-[var(--mut)]">No hay entregas urgentes.</div>}
        {items.map(({ row, time }) => (
          <button key={row.id} className="border-l-4 border-[var(--org)] bg-[#fff7f5] p-3 text-left hover:bg-[#faece7]" onClick={() => onSelect(row)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.project}</div>
                <div className="text-[11px] text-[var(--mut)]">{row.type} · {displayDispatchDetail(row)}</div>
              </div>
              <span className="status-badge status-cambio">{time.label}</span>
            </div>
            <div className="mt-3 text-[11px] text-[var(--mut)]">{shortDate(row.scheduledAt)} · {row.units || "-"} uds</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductionProgress({
  row,
  compact = false,
  saving = false,
  disabled = false,
  onStageChange
}: {
  row: Pick<DispatchRow, "fabricationType" | "productionStage">;
  compact?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onStageChange?: (stage: string) => void;
}) {
  const progress = productionProgress(row);
  const canChange = Boolean(onStageChange) && !disabled;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--blk)]">{row.fabricationType ?? "RTA"}</span>
        <span className="text-[10px] text-[var(--mut)]">{row.productionStage ?? "Plan"} · {progress.percent}%{saving ? " · guardando" : ""}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden bg-[var(--g2)]">
        <div className="h-full bg-[var(--org)]" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className={`mt-2 grid gap-1 ${compact ? "" : ""}`} style={{ gridTemplateColumns: `repeat(${progress.route.length}, minmax(0, 1fr))` }}>
        {progress.route.map((stage, index) => {
          const active = index <= progress.currentIndex;
          const current = stage === (row.productionStage ?? "Plan");
          const content = compact ? stage : stage;
          return (
            <button
              key={stage}
              type="button"
              disabled={!canChange}
              aria-pressed={current}
              onClick={(event) => {
                event.stopPropagation();
                onStageChange?.(stage);
              }}
              className={`border-t-2 px-0.5 pt-1 text-center leading-tight ${compact ? "text-[8px]" : "text-[9px]"} ${current ? "border-[var(--org)] bg-[#faece7] font-bold text-[var(--org)]" : active ? "border-[var(--org)] text-[var(--blk)]" : "border-[var(--g2)] text-[var(--mut)]"} ${canChange ? "hover:bg-[#faece7] hover:text-[var(--org)]" : "cursor-default"}`}
              title={canChange ? `Cambiar a ${stage}` : stage}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskModal({ row, role, busy, onClose, onSave }: {
  row?: DispatchRow;
  role: Role;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(row ? toTaskDraft(row) : emptyTask());
  const readonly = role !== "admin";
  const valid = draft.project.trim() && draft.type && draft.scheduledAt;
  const isConstructora = draft.businessLine === "Constructora";
  const unitsLabel = !isConstructora ? "Cantidad de muebles" : draft.projectType === "Casas" ? "Cantidad de casas" : draft.projectType === "Edificio" ? "Cantidad de deptos" : "Cantidad de unidades";

  function setField(field: keyof TaskDraft, value: string) {
    setDraft((current) => {
      if (field === "businessLine" && value !== "Constructora") {
        return { ...current, businessLine: value, projectType: "No aplica", tower: "", core: "", floor: "" };
      }
      if (field === "businessLine" && value === "Constructora") {
        return { ...current, businessLine: value, projectType: current.projectType === "No aplica" ? "Edificio" : current.projectType };
      }
      if (field === "fabricationType") {
        const route = productionRouteFor(value);
        const nextStage = route.some((stage) => stage === current.productionStage) ? current.productionStage : route[0];
        return { ...current, fabricationType: value, productionStage: nextStage };
      }
      return { ...current, [field]: value };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-[640px] max-w-full bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[var(--g2)] px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.04em]">{row ? "Editar tarea" : "Agregar tarea"}</div>
          <div className="text-[11px] text-[var(--mut)]">Proyecto, conjunto, fecha programada y unidades.</div>
        </div>
        <div className="grid gap-3 px-5 py-4">
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Línea de negocio</label>
          <select className="field" value={draft.businessLine} disabled={readonly} onChange={(event) => setField("businessLine", event.target.value)}>
            {businessLines.map((line) => <option key={line} value={line}>{line}</option>)}
          </select>
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">{isConstructora ? "Proyecto" : "Cliente / Canal / Entidad"}</label>
          <input className="field" value={draft.project} disabled={readonly} onChange={(event) => setField("project", event.target.value)} placeholder={isConstructora ? "Ej: VIENTO NORTE" : "Ej: cliente particular, retail o convenio"} />
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Tipo proyecto</label>
          <select className="field" value={draft.projectType} disabled={readonly || !isConstructora} onChange={(event) => setField("projectType", event.target.value)}>
            {projectTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Conjunto</label>
          <select className="field" value={draft.type} disabled={readonly} onChange={(event) => setField("type", event.target.value)}>
            {dispatchTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Fabricación</label>
              <select className="field" value={draft.fabricationType} disabled={readonly} onChange={(event) => setField("fabricationType", event.target.value)}>
                {fabricationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Estado producción</label>
              <select className="field" value={draft.productionStage} disabled={readonly} onChange={(event) => setField("productionStage", event.target.value)}>
                {productionRouteFor(draft.fabricationType).map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Ingreso producción</label>
              <input className="field" type="date" value={draft.productionStartAt} disabled={readonly} onChange={(event) => setField("productionStartAt", event.target.value)} />
            </div>
          </div>
          {!isConstructora && (
            <>
              <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Descripción</label>
              <input className="field" value={draft.description} disabled={readonly} onChange={(event) => setField("description", event.target.value)} placeholder="Ej: mueble, producto, orden o requerimiento" />
            </>
          )}
          {isConstructora && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Torre</label>
                <input className="field" value={draft.tower} disabled={readonly} onChange={(event) => setField("tower", event.target.value)} placeholder="No aplica si queda vacío" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Núcleo</label>
                <input className="field" value={draft.core} disabled={readonly} onChange={(event) => setField("core", event.target.value)} placeholder="No aplica" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">{draft.projectType === "Casas" ? "Casa" : "Piso"}</label>
                <input className="field" value={draft.floor} disabled={readonly} onChange={(event) => setField("floor", event.target.value)} placeholder={draft.projectType === "Casas" ? "Ej: 49 - 53 - 55" : "No aplica"} />
              </div>
            </div>
          )}
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Observación</label>
          <input className="field" value={draft.detail} disabled={readonly} onChange={(event) => setField("detail", event.target.value)} placeholder="Comentario operativo opcional" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">{unitsLabel}</label>
              <input className="field" type="number" min="0" value={draft.units} disabled={readonly} onChange={(event) => setField("units", event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Fecha programada</label>
              <input className="field" type="date" value={draft.scheduledAt} disabled={readonly} onChange={(event) => setField("scheduledAt", event.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-between border-t border-[var(--g2)] px-5 py-4">
          <div className="flex items-center gap-2 text-[10px] text-[var(--mut)]"><Shield size={13} />Solo admin edita tareas</div>
          <div className="flex gap-2">
            <button className="thin-button" onClick={onClose}>Cancelar</button>
            <button className="primary-button inline-flex items-center gap-2" disabled={busy || readonly || !valid} onClick={() => onSave(draft)}><Save size={14} />Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusModal({ row, role, busy, productionSaving = false, message = "", onClose, onEdit, onDelete, onSave, onProductionSave }: {
  row: DispatchRow;
  role: Role;
  busy: boolean;
  productionSaving?: boolean;
  message?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (row: DispatchRow, state: DispatchState, actualAt: string, notes: string, completionDueAt?: string) => void;
  onProductionSave: (row: DispatchRow, productionStage: string, fabricationType?: DispatchRow["fabricationType"], productionStartAt?: string) => void;
}) {
  const [state, setState] = useState<DispatchState>(row.status?.state ?? "pendiente");
  const [actualAt, setActualAt] = useState(dateOnly(row.status?.actualAt));
  const [completionDueAt, setCompletionDueAt] = useState(todayOnly());
  const [notes, setNotes] = useState(row.status?.notes ?? "");
  const diff = businessDiffDays(row.scheduledAt, actualAt);
  const readonly = role === "lector";
  const showDispatchSummary = state === "despachado" && Boolean(actualAt) && diff !== null;
  const currentTime = timeState(row);
  const productionLeadTime = productionWindow(row);
  function chooseState(nextState: DispatchState) {
    setState(nextState);
    if (nextState !== "pendiente" && !actualAt) setActualAt(todayOnly());
    if (nextState === "parcial" && !notes.trim()) setNotes("Entrega parcial. Completar saldo pendiente.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-[480px] max-w-full overflow-y-auto bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[var(--g2)] px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.04em]">{row.project} · {row.type}</div>
          <div className="text-[11px] text-[var(--mut)]">{displayDispatchDetail(row)} · Programado {shortDate(row.scheduledAt)}</div>
        </div>
        <div className="space-y-3 px-5 py-4">
          {busy && <div className="border-l-4 border-[var(--org)] bg-[#faece7] px-3 py-2 text-xs font-semibold text-[#8b2500]">Guardando cambios...</div>}
          {!busy && message && <div className="border-l-4 border-[var(--ok)] bg-[#edf7ee] px-3 py-2 text-xs font-semibold text-[#1f6b36]">{message}</div>}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[var(--g1)] p-3"><b>Línea</b><br />{row.businessLine ?? "Constructora"}</div>
            <div className="bg-[var(--g1)] p-3"><b>Tipo proyecto</b><br />{row.projectType ?? "Edificio"}</div>
            <div className="bg-[var(--g1)] p-3"><b>Unidades</b><br />{unitLabel(row)}</div>
            <div className="bg-[var(--g1)] p-3"><b>Fabricación</b><br />{row.fabricationType ?? "RTA"}</div>
            <div className="bg-[var(--g1)] p-3"><b>Ingreso producción</b><br />{shortDate(row.productionStartAt)}</div>
            <div className="bg-[var(--g1)] p-3"><b>Tiempo producción</b><br /><span className={productionLeadTime.tone}>{productionLeadTime.label}</span></div>
            <div className="bg-[var(--g1)] p-3"><b>Fecha programada</b><br />{shortDate(row.scheduledAt)}</div>
            <div className="bg-[var(--g1)] p-3"><b>Estado tiempo</b><br /><span className={currentTime.tone}>{currentTime.label}</span></div>
            <div className="bg-[var(--g1)] p-3"><b>Ultima actualizacion</b><br />{shortDate(row.status?.updatedAt)}</div>
            {(row.businessLine ?? "Constructora") === "Constructora" && (
              <>
                <div className="bg-[var(--g1)] p-3"><b>Torre</b><br />{row.tower || "No aplica"}</div>
                <div className="bg-[var(--g1)] p-3"><b>Núcleo</b><br />{row.core || "No aplica"}</div>
                <div className="bg-[var(--g1)] p-3"><b>{row.projectType === "Casas" ? "Casa" : "Piso"}</b><br />{row.floor || houseLocationFromDetail(row) || "No aplica"}</div>
              </>
            )}
          </div>
          <div className="border border-[var(--g2)] p-3">
            <ProductionProgress row={row} saving={productionSaving} disabled={role === "lector"} onStageChange={(stage) => onProductionSave(row, stage)} />
          </div>
          <label className="block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Estado</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "pendiente", label: "Pendiente", help: "Aun no entregado" },
              { value: "parcial", label: "Parcial", help: "Crea tarea para completar" },
              { value: "despachado", label: "Despachado completo", help: "Cuenta como cumplimiento" },
              { value: "cambio", label: "Cambio", help: "Reprogramado" }
            ].map((option) => (
              <label key={option.value} className={`cursor-pointer border p-3 ${state === option.value ? "border-[var(--org)] bg-[#faece7]" : "border-[var(--g2)] bg-white"} ${readonly ? "opacity-60" : ""}`}>
                <span className="flex items-center gap-2 text-xs font-bold">
                  <input type="radio" name="dispatch-state" checked={state === option.value} disabled={readonly} onChange={() => chooseState(option.value as DispatchState)} />
                  {option.label}
                </span>
                <span className="mt-1 block text-[10px] text-[var(--mut)]">{option.help}</span>
              </label>
            ))}
          </div>
          {state !== "pendiente" && (
            <>
              <label className="block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">{state === "cambio" ? "Nueva fecha propuesta" : state === "parcial" ? "Fecha de entrega parcial" : "Fecha real de despacho"}</label>
              <input className="field" type="date" value={actualAt} disabled={readonly} onChange={(event) => setActualAt(event.target.value)} />
              {diff !== null && <div className="border-l-4 border-[var(--org)] bg-[var(--g1)] p-3 text-xs"><b>{diff === 0 ? "En fecha" : diff > 0 ? `${diff} dias de atraso` : `${Math.abs(diff)} dias de adelanto`}</b></div>}
            </>
          )}
          {state === "parcial" && (
            <div className="border border-[var(--g2)] bg-[#fffaf0] p-3">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Fecha compromiso para completar</label>
              <input className="field" type="date" value={completionDueAt} disabled={readonly} onChange={(event) => setCompletionDueAt(event.target.value)} />
              <p className="mt-2 text-[11px] text-[var(--mut)]">Al guardar se crea una tarea pendiente Completar entrega parcial. Esa tarea entra a urgentes si corresponde.</p>
            </div>
          )}
          {showDispatchSummary && (
            <div className="border border-[var(--g2)] bg-white">
              <div className="border-b border-[var(--g2)] bg-[var(--blk)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">Resumen de despacho</div>
              <div className="grid grid-cols-2 gap-2 p-3 text-[11px]">
                <div className="bg-[var(--g1)] p-3">
                  <div className="text-[9px] uppercase text-[var(--mut)]">Programado</div>
                  <div className="font-semibold">{shortDate(row.scheduledAt)}</div>
                </div>
                <div className="bg-[var(--g1)] p-3">
                  <div className="text-[9px] uppercase text-[var(--mut)]">Real</div>
                  <div className="font-semibold">{shortDate(actualAt)}</div>
                </div>
                <div className="bg-[var(--g1)] p-3">
                  <div className="text-[9px] uppercase text-[var(--mut)]">Unidades</div>
                  <div className="font-semibold">{unitLabel(row)}</div>
                </div>
                <div className="bg-[var(--g1)] p-3">
                  <div className="text-[9px] uppercase text-[var(--mut)]">Resultado</div>
                  <div className={diff > 0 ? "font-semibold text-[var(--bad)]" : diff < 0 ? "font-semibold text-[var(--ok)]" : "font-semibold text-[var(--mut)]"}>
                    {diff === 0 ? "En fecha" : diff > 0 ? `${diff}d atraso` : `${Math.abs(diff)}d adelanto`}
                  </div>
                </div>
              </div>
            </div>
          )}
          <label className="block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Notas</label>
          <textarea className="field min-h-24" value={notes} disabled={readonly} onChange={(event) => setNotes(event.target.value)} />
          <div className="border-t border-[var(--g2)] pt-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">
              <span className="inline-flex items-center gap-2"><History size={13} />Historial</span>
              <Link className="thin-button px-2 py-1 no-underline" href={`/bitacora?project=${encodeURIComponent(row.project)}`}>Ver cambios</Link>
            </div>
            {(row.events ?? []).length === 0 ? <div className="text-xs text-[var(--mut)]">Sin eventos registrados.</div> : row.events?.map((event) => (
              <div key={event.id} className="mb-2 text-xs text-[var(--mut)]">{shortDate(event.createdAt)} · {event.state} · {event.notes || "sin notas"}</div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--g2)] px-5 py-4">
          <div className="flex gap-2">
            <button className="thin-button inline-flex items-center gap-2" disabled={role !== "admin"} onClick={onEdit}><Edit3 size={13} />Editar</button>
            <button className="thin-button inline-flex items-center gap-2" disabled={role !== "admin"} onClick={onDelete}><Trash2 size={13} />Eliminar</button>
          </div>
          <div className="flex gap-2">
            <button className="thin-button" onClick={onClose}>Cancelar</button>
            <button className="primary-button inline-flex items-center gap-2" disabled={busy || readonly} onClick={() => onSave(row, state, actualAt, notes, completionDueAt)}><Save size={14} />{busy ? "Guardando..." : "Guardar estado"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

