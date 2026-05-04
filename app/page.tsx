"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ClipboardList, Download, Edit3, Eye, EyeOff, History, LogOut, Plus, RefreshCw, Save, Shield, Trash2, Upload, Users } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import type { DashboardPayload, DispatchRow, DispatchState, ProgramSummary, Role } from "@/lib/client-types";

const dispatchTypes = ["COCINA", "CLOSET", "BAÃ‘O", "PUERTAS ABATIR", "MARCOS CLOSET", "QUINCALLERIA", "ADICIONAL", "POST VENTA"];
const APP_TIME_ZONE = "America/Santiago";
const APP_TODAY = "";

type TaskDraft = {
  project: string;
  type: string;
  detail: string;
  units: string;
  scheduledAt: string;
};

type BulkDraft = {
  state: DispatchState;
  actualAt: string;
  notes: string;
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

const emptyTask = (): TaskDraft => ({
  project: "",
  type: "COCINA",
  detail: "",
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
  if (type === "BAÃ‘O") return "bg-[#5a5a5a]";
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
    project: row.project,
    type: row.type,
    detail: row.detail ?? "",
    units: String(row.units ?? 0),
    scheduledAt: dateOnly(row.scheduledAt)
  };
}

function normalizeProjectName(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  const upper = clean.toUpperCase();
  if (upper === "LOS SAUCES" || upper === "EL SAUCE") return "EL SAUCE";
  return upper;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [programId, setProgramId] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem("formatto-session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  const role = session?.role ?? "lector";
  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-formatto-role": role }), [role]);

  const loadPrograms = useCallback(async () => {
    const res = await fetch("/api/programs", { headers });
    const data = await res.json();
    const list = data.programs ?? [];
    setPrograms(list);
    const active =
      list.find((p: ProgramSummary) => p.active && (p._count?.dispatches ?? 0) > 0) ??
      [...list].sort((a: ProgramSummary, b: ProgramSummary) => (b._count?.dispatches ?? 0) - (a._count?.dispatches ?? 0))[0];
    if (active && !programId) setProgramId(active.id);
  }, [headers, programId]);

  const loadDashboard = useCallback(async (id = programId) => {
    const suffix = id ? `?programId=${id}` : "";
    const res = await fetch(`/api/dashboard${suffix}`, { headers });
    setPayload(await res.json());
  }, [headers, programId]);

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
      rows = rows.filter((row) => [row.project, row.type, row.detail, String(row.units)].join(" ").toLowerCase().includes(term));
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
  }, [payload, typeFilter, stateFilter, projectFilter, timeFilter, search]);

  const projects = useMemo(() => ["todos", ...Array.from(new Set((payload?.dispatches ?? []).map((row) => row.project)))], [payload]);
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
  const checkedRows = useMemo(() => dispatches.filter((row) => checked.includes(row.id)), [checked, dispatches]);
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
  const urgentRows = useMemo(() => {
    return (payload?.dispatches ?? [])
      .filter((row) => (row.status?.state ?? "pendiente") !== "despachado")
      .map((row) => ({ row, time: timeState(row) }))
      .filter((item) => item.time.value >= 0 || Math.abs(item.time.value) <= 3 || item.row.status?.state === "cambio")
      .sort((a, b) => b.time.value - a.time.value)
      .slice(0, 8);
  }, [payload]);
  const timelineRows = useMemo(() => {
    return (payload?.dispatches ?? [])
      .slice()
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .filter((row) => (row.status?.state ?? "pendiente") !== "despachado");
  }, [payload]);

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
        project: normalizeProjectName(draft.project),
        type: draft.type,
        detail: draft.detail.trim() || null,
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
    setBusy(true);
    const res = await fetch(`/api/dispatches/${row.id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state, actualAt: actualAt || null, completionDueAt: completionDueAt || null, notes })
    });
    setBusy(false);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setMessage(error.error ?? "No se pudo guardar el estado.");
      return;
    }
    setSelected(null);
    setMessage("Estado guardado correctamente.");
    await loadDashboard();
  }

  async function saveBulkStatus(draft: BulkDraft) {
    if (checked.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/dispatches/bulk-status", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        ids: checked,
        status: { state: draft.state, actualAt: draft.actualAt || null, notes: draft.notes }
      })
    });
    setBusy(false);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setMessage(error.error ?? "No se pudo actualizar masivamente.");
      return;
    }
    setMessage(`${checked.length} tareas actualizadas.`);
    setChecked([]);
    await loadDashboard();
  }

  async function importExcel(file: File) {
    setBusy(true);
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const targetProgramId = await ensureProgram();
    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const get = (...keys: string[]) => {
        const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const found = Object.keys(row).find((key) => keys.some((candidate) => normalize(key).includes(normalize(candidate))));
        return found ? String(row[found] ?? "").trim() : "";
      };
      const project = get("proyecto");
      const scheduledAt = get("fecha despacho", "fecha");
      if (!project || !scheduledAt) {
        skipped++;
        continue;
      }
      const date = scheduledAt.length >= 10 ? scheduledAt.slice(0, 10) : dateOnly(new Date(scheduledAt).toISOString());
      const tower = get("torre");
      const core = get("nucleo", "nucleos", "núcleo", "núcleos");
      const floor = get("piso");
      const observation = get("observacion", "observación", "obs");
      const units = Number(get("deptos/casas", "depto/casa", "deptos", "depto", "casas", "casa", "unidades")) || 0;
      const detail = [
        tower ? `Torre ${tower}` : "",
        core ? `Nucleo ${core}` : "",
        floor ? `Piso ${floor}` : "",
        observation
      ].filter(Boolean).join(" · ");
      const res = await fetch(`/api/programs/${targetProgramId}/dispatches`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          project,
          type: get("tipo", "conjunto") || "COCINA",
          detail,
          tower: tower || null,
          core: core || null,
          floor: floor || null,
          units,
          scheduledAt: date,
          source: "excel"
        })
      });
      if (res.ok) created++;
    }

    setBusy(false);
    setMessage(`Importadas ${created} tareas al tablero actual.${skipped ? ` ${skipped} filas omitidas por falta de proyecto o fecha.` : ""}`);
    await loadDashboard(targetProgramId);
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

      <section className="px-6 py-4">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-9">
          {[
            { label: "Total", value: summary.total },
            { label: "Proyectos", value: summary.projects },
            { label: "Despachados", value: summary.dispatched },
            { label: "Parciales", value: summary.partial },
            { label: "Cambios", value: summary.changes },
            { label: "Atraso", value: `${totalBuckets.lateRate}%`, count: totalBuckets.late },
            { label: "On time", value: `${totalBuckets.onTimeRate}%`, count: totalBuckets.onTime },
            { label: "Adelanto", value: `${totalBuckets.earlyRate}%`, count: totalBuckets.early },
            { label: "Pendiente", value: `${totalBuckets.pendingRate}%`, count: totalBuckets.pending }
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
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">CategorÃ­a</label>
              <select className="field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="todos">Todas las categorÃ­as</option>
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
                <option value="proximas">PrÃ³ximos 7 dÃ­as</option>
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

          <div className="mb-6 grid grid-cols-1 gap-4">
            <TimelinePanel rows={timelineRows} offset={timelineOffset} onMove={setTimelineOffset} onSelect={setSelected} />
            <UrgentPanel items={urgentRows} onSelect={setSelected} />
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-semibold">Panel de Control de Tareas</div>
              <div className="text-xs text-[var(--mut)]">{dispatches.length} tareas encontradas</div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <button className="primary-button inline-flex items-center gap-2" disabled={busy || role !== "admin"} onClick={() => setTaskModal({ mode: "create" })}><Plus size={14} />Agregar tarea</button>
              <button className="thin-button" onClick={collapseAllProjects}>Colapsar todo</button>
              <button className="thin-button" onClick={expandAllProjects}>Expandir todo</button>
            </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(720px,1fr)_360px]">
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
        <BulkStatusBar count={checked.length} rows={checkedRows} role={role} busy={busy} onClear={() => setChecked([])} onSave={saveBulkStatus} />

        <div className="overflow-x-auto border border-[var(--g2)]">
          <div className="min-w-[720px] bg-white">
            <div className="grid grid-cols-[32px_1.45fr_104px_104px_86px_38px] border-b border-[var(--g2)] bg-[var(--blk)] px-2 py-1.5 text-[9px] uppercase tracking-[0.06em] text-white">
              <button className="text-left" onClick={toggleAllVisible}>Sel</button>
              <div>Entrega</div><div>ProgramaciÃ³n</div><div>Resultado</div><div>Estado</div><div></div>
            </div>
            {groupedDispatches.map((group) => (
              <div key={group.project} className="border-b border-[var(--g2)]">
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
                    <div key={row.id} className={`grid grid-cols-[32px_1.45fr_104px_104px_86px_38px] items-center border-t border-[var(--g2)] px-2 py-1.5 text-left text-[11px] leading-tight hover:bg-[var(--g1)] ${rowTone}`}>
                      <input type="checkbox" checked={checked.includes(row.id)} onChange={() => toggleChecked(row.id)} aria-label={`Seleccionar ${row.project}`} />
                      <button className="min-w-0 text-left" onClick={() => setSelected(row)}>
                        <div className="truncate font-semibold">{row.type} Â· {row.detail || "-"}</div>
                        <div className="text-[10px] text-[var(--mut)]">{row.units || "-"} uds</div>
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
                      <button className="thin-button p-2" disabled={role !== "admin"} onClick={() => setTaskModal({ mode: "edit", row })} title="Editar tarea"><Edit3 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
          </div>
          <OperationsSummaryPanel
            groups={groupedDispatches}
            rows={dispatches}
            projects={projects}
            typeFilter={typeFilter}
            stateFilter={stateFilter}
            projectFilter={projectFilter}
            timeFilter={timeFilter}
            onTypeFilter={setTypeFilter}
            onStateFilter={setStateFilter}
            onProjectFilter={setProjectFilter}
            onTimeFilter={setTimeFilter}
            onClearFilters={() => { setTypeFilter("todos"); setProjectFilter("todos"); setStateFilter("todos"); setTimeFilter("todos"); setSearch(""); }}
            search={search}
            onSearch={setSearch}
            projectSort={projectSort}
            onProjectSort={setProjectSort}
            onProject={(project) => setProjectFilter((current) => current === project ? "todos" : project)}
            onSelect={setSelected}
          />
        </div>
      </section>

      {selected && (
        <StatusModal
          row={selected}
          role={role}
          busy={busy}
          onClose={() => setSelected(null)}
          onEdit={() => { setSelected(null); setTaskModal({ mode: "edit", row: selected }); }}
          onDelete={() => deleteTask(selected)}
          onSave={saveStatus}
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

function DashboardMetric({ label, value, count }: { label: string; value: string | number; count?: number }) {
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
                      <div className="text-[10px] text-[var(--mut)]">{user.lastActivity ?? "Activo"} Â· {shortDate(user.lastSeenAt)}</div>
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

function OperationsSummaryPanel({
  groups,
  rows,
  projects,
  typeFilter,
  stateFilter,
  projectFilter,
  timeFilter,
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
  typeFilter: string;
  stateFilter: DispatchState | "todos";
  projectFilter: string;
  timeFilter: "todos" | "atrasadas" | "hoy" | "proximas";
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Filtros</div>
          <button className="thin-button px-2 py-1" onClick={onClearFilters}>Limpiar</button>
        </div>
        <div className="grid gap-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Buscar</label>
            <input className="field" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Proyecto, conjunto, piso..." />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Orden</label>
            <select className="field" value={projectSort} onChange={(event) => onProjectSort(event.target.value as "prioridad" | "atraso" | "cumplimiento" | "nombre")}>
              <option value="prioridad">Orden natural operativo</option>
              <option value="atraso">Ordenar por atraso</option>
              <option value="cumplimiento">Menor cumplimiento</option>
              <option value="nombre">Ordenar A-Z</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Proyecto</label>
            <select className="field" value={projectFilter} onChange={(event) => onProjectFilter(event.target.value)}>
              {projects.map((project) => <option key={project} value={project}>{project === "todos" ? "Todos los proyectos" : project}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Categoria</label>
            <select className="field" value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)}>
              <option value="todos">Todas las categorias</option>
              {dispatchTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Estado</label>
              <select className="field" value={stateFilter} onChange={(event) => onStateFilter(event.target.value as DispatchState | "todos")}>
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="despachado">Despachado</option>
                <option value="cambio">Cambio</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Tiempo</label>
              <select className="field" value={timeFilter} onChange={(event) => onTimeFilter(event.target.value as "todos" | "atrasadas" | "hoy" | "proximas")}>
                <option value="todos">Todos</option>
                <option value="atrasadas">Atrasadas</option>
                <option value="hoy">Hoy</option>
                <option value="proximas">Proximas</option>
              </select>
            </div>
          </div>
        </div>
      </section>
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
        <div className="space-y-2">
          {focusProjects.map((group) => (
            <button key={group.project} className={`w-full border-l-4 p-2 text-left hover:bg-[#faece7] ${projectTone(group)}`} onClick={() => onProject(group.project)} title={projectFilter === group.project ? "Quitar foco del proyecto" : "Filtrar por proyecto"}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold">{group.project}</span>
                <span className="text-[10px] text-[var(--mut)]">{projectFilter === group.project ? "activo" : `${group.performance?.completion ?? 0}%`}</span>
              </div>
              <div className="mt-1 text-[10px] text-[var(--mut)]">
                {group.performance ? `${group.performance.dispatched}/${group.performance.total} desp.` : `${group.rows.length} tareas`}
                {group.delayedTasks ? ` Â· ${group.delayedTasks} atraso` : ""}
                {group.pendingCritical ? ` Â· ${group.pendingCritical} criticas` : ""}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="border border-[var(--g2)] bg-white p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--mut)]">Tareas criticas abiertas</div>
        <div className="space-y-2">
          {critical.map((row) => (
            <button key={row.id} className="w-full bg-[#fff7f5] p-2 text-left hover:bg-[#faece7]" onClick={() => onSelect(row)}>
              <div className="truncate text-xs font-bold">{row.project}</div>
              <div className="truncate text-[10px] text-[var(--mut)]">{row.type} Â· {row.detail || "-"}</div>
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
              <div className="truncate text-[10px] text-[var(--mut)]">{row.type} Â· {row.detail || "-"}</div>
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
          <input type="checkbox" checked={allSelected} onChange={onSelectAll} aria-label={`Seleccionar tareas de ${group.project}`} />
          <div>
          <div className="text-sm font-bold leading-tight">{group.project}</div>
          <div className="text-[10px] text-[var(--mut)]">
            {performance ? `${performance.dispatched}/${performance.total} despachadas` : `${group.rows.length} tareas`}
            {group.pendingCritical > 0 ? ` Â· ${group.pendingCritical} criticas` : ""}
            {group.delayedTasks > 0 ? ` Â· ${group.delayedTasks} con atraso` : ""}
            {group.maxDelay > 0 ? ` Â· max ${group.maxDelay}d atraso` : ""}
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
  const days = useMemo(() => {
    const center = addBusinessDays(today, offset * 9);
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

  return (
    <section className="border border-[var(--g2)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-base font-semibold">Panel de Control de Despacho</div>
          <div className="text-xs text-[var(--mut)]">4 dias atras Â· hoy Â· 4 dias adelante</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="thin-button" onClick={() => onMove(offset - 1)}>Anterior</button>
          <button className="thin-button active" onClick={() => onMove(0)}>Hoy</button>
          <button className="thin-button" onClick={() => onMove(offset + 1)}>Siguiente</button>
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
                        <div className="truncate text-[9px] text-[var(--mut)]">{row.type} Â· {row.detail || "-"}</div>
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
                <div className="text-[11px] text-[var(--mut)]">{row.type} Â· {row.detail || "-"}</div>
              </div>
              <span className="status-badge status-cambio">{time.label}</span>
            </div>
            <div className="mt-3 text-[11px] text-[var(--mut)]">{shortDate(row.scheduledAt)} Â· {row.units || "-"} uds</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function BulkStatusBar({ count, rows, role, busy, onClear, onSave }: {
  count: number;
  rows: DispatchRow[];
  role: Role;
  busy: boolean;
  onClear: () => void;
  onSave: (draft: BulkDraft) => void;
}) {
  const [state, setState] = useState<DispatchState>("despachado");
  const [actualAt, setActualAt] = useState(todayOnly());
  const [notes, setNotes] = useState("");
  const disabled = count === 0 || role === "lector" || busy;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border border-[var(--g2)] bg-white p-3">
      <div className="mr-2 text-xs font-semibold text-[var(--blk)]">{count} seleccionadas</div>
      <select className="field w-auto" value={state} disabled={disabled} onChange={(event) => setState(event.target.value as DispatchState)}>
        <option value="despachado">Despachado</option>
        <option value="parcial">Parcial</option>
        <option value="cambio">Cambio</option>
        <option value="pendiente">Pendiente</option>
      </select>
      <input className="field w-auto" type="date" value={actualAt} disabled={disabled || state === "pendiente"} onChange={(event) => setActualAt(event.target.value)} title={state === "parcial" ? "Fecha compromiso para completar" : "Fecha"} />
      <input className="field min-w-[260px] flex-1" value={notes} disabled={disabled} onChange={(event) => setNotes(event.target.value)} placeholder={state === "parcial" ? "Motivo parcial y saldo por completar" : rows.length ? `Nota para ${rows.length} tareas` : "Selecciona tareas para actualizacion masiva"} />
      <button className="primary-button" disabled={disabled} onClick={() => onSave({ state, actualAt, notes })}>Actualizar masivo</button>
      <button className="thin-button" disabled={count === 0} onClick={onClear}>Limpiar</button>
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

  function setField(field: keyof TaskDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-[520px] max-w-full bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[var(--g2)] px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.04em]">{row ? "Editar tarea" : "Agregar tarea"}</div>
          <div className="text-[11px] text-[var(--mut)]">Proyecto, conjunto, fecha programada y unidades.</div>
        </div>
        <div className="grid gap-3 px-5 py-4">
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Proyecto</label>
          <input className="field" value={draft.project} disabled={readonly} onChange={(event) => setField("project", event.target.value)} placeholder="Ej: VIENTO NORTE" />
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Conjunto</label>
          <select className="field" value={draft.type} disabled={readonly} onChange={(event) => setField("type", event.target.value)}>
            {dispatchTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <label className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Detalle</label>
          <input className="field" value={draft.detail} disabled={readonly} onChange={(event) => setField("detail", event.target.value)} placeholder="Torre, piso, nucleo, observacion" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Unidades</label>
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

function StatusModal({ row, role, busy, onClose, onEdit, onDelete, onSave }: {
  row: DispatchRow;
  role: Role;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (row: DispatchRow, state: DispatchState, actualAt: string, notes: string, completionDueAt?: string) => void;
}) {
  const [state, setState] = useState<DispatchState>(row.status?.state ?? "pendiente");
  const [actualAt, setActualAt] = useState(dateOnly(row.status?.actualAt));
  const [completionDueAt, setCompletionDueAt] = useState(todayOnly());
  const [notes, setNotes] = useState(row.status?.notes ?? "");
  const diff = businessDiffDays(row.scheduledAt, actualAt);
  const readonly = role === "lector";
  const showDispatchSummary = state === "despachado" && Boolean(actualAt) && diff !== null;
  const currentTime = timeState(row);
  function chooseState(nextState: DispatchState) {
    setState(nextState);
    if (nextState !== "pendiente" && !actualAt) setActualAt(todayOnly());
    if (nextState === "parcial" && !notes.trim()) setNotes("Entrega parcial. Completar saldo pendiente.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-[480px] max-w-full overflow-y-auto bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[var(--g2)] px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.04em]">{row.project} Â· {row.type}</div>
          <div className="text-[11px] text-[var(--mut)]">{row.detail || "-"} Â· Programado {shortDate(row.scheduledAt)}</div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[var(--g1)] p-3"><b>Unidades</b><br />{row.units || "-"}</div>
            <div className="bg-[var(--g1)] p-3"><b>Fecha programada</b><br />{shortDate(row.scheduledAt)}</div>
            <div className="bg-[var(--g1)] p-3"><b>Estado tiempo</b><br /><span className={currentTime.tone}>{currentTime.label}</span></div>
            <div className="bg-[var(--g1)] p-3"><b>Ultima actualizacion</b><br />{shortDate(row.status?.updatedAt)}</div>
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
                  <div className="font-semibold">{row.units || "-"} uds</div>
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
              <div key={event.id} className="mb-2 text-xs text-[var(--mut)]">{shortDate(event.createdAt)} Â· {event.state} Â· {event.notes || "sin notas"}</div>
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
            <button className="primary-button inline-flex items-center gap-2" disabled={busy || readonly} onClick={() => onSave(row, state, actualAt, notes, completionDueAt)}><Save size={14} />Guardar estado</button>
          </div>
        </div>
      </div>
    </div>
  );
}

