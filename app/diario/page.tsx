"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Download, FileText, Home, Mail, Plus, Printer, RefreshCw, RotateCw, X } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import type { Role } from "@/lib/client-types";

type Session = { email: string; role: Role; name: string };
type DailyReport = {
  date: string;
  summary: {
    activeProjects: number;
    totalTasks: number;
    dayTasks: number;
    dayCompleted: number;
    dayPending: number;
    pending: number;
    alerts: number;
    dayProgress: number;
    accumulatedProgress: number;
  };
  projects: Array<{
    project: string;
    status: string;
    todayTotal: number;
    todayCompleted: number;
    todayPending: number;
    pending: number;
    lateOpen: number;
    dayProgress: number;
    accumulatedProgress: number;
    observations: string;
    alerts: string[];
    lateTasks: Array<{
      id: string;
      type: string;
      detail?: string | null;
      units: number;
      scheduledAt: string;
      daysLate: number;
      notes?: string | null;
    }>;
    tasks: Array<{
      id: string;
      type: string;
      detail?: string | null;
      units: number;
      scheduledAt: string;
      actualAt: string;
      state: string;
      variance: number | null;
      responsible: string;
      progress: string;
      notes?: string | null;
    }>;
  }>;
};

type HistoryItem = {
  id: string;
  createdAt: string;
  reportDate: string;
  senderEmail: string;
  recipients: string[];
  projects: string[];
  fileName: string;
  status: "enviado" | "error";
  error?: string | null;
};

type UserOption = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  area?: string | null;
  active: boolean;
};

type ReportChoice = "diario" | "resumen";

function todayInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--g2)] border-t-[3px] border-t-[var(--org)] bg-white p-3">
      <div className="text-[9px] uppercase tracking-[0.07em] text-[var(--mut)]">{label}</div>
      <div className="mt-1 text-2xl font-light text-[var(--blk)]">{value}</div>
    </div>
  );
}

function TableHeader({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={`${className} bg-[var(--blk)] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.06em] text-white`}>
      {children}
    </div>
  );
}

function taskResult(task: DailyReport["projects"][number]["tasks"][number]) {
  if (task.state === "despachado" && task.variance === 0) return "En fecha";
  if (task.state === "despachado" && task.variance !== null && task.variance > 0) return `${task.variance}d atraso`;
  if (task.state === "despachado" && task.variance !== null && task.variance < 0) return `${Math.abs(task.variance)}d adelanto`;
  if (task.state === "cambio") return "Reprogramado";
  return "Pendiente";
}

export default function DailyPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sheet, setSheet] = useState<"diario" | "resumen">("diario");
  const [date, setDate] = useState(todayInput());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientModal, setRecipientModal] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedReports, setSelectedReports] = useState<ReportChoice[]>(["diario"]);
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("formatto-session");
    if (raw) setSession(JSON.parse(raw));
    const params = new URLSearchParams(window.location.search);
    if (params.get("hoja") === "resumen") setSheet("resumen");
  }, []);

  const role = session?.role ?? "lector";
  const canGenerate = role === "admin" || role === "operador";
  const canSend = role === "admin";
  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);
  const filteredUsers = useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.fullName, user.email, user.area ?? "", user.role].join(" ").toLowerCase().includes(term));
  }, [recipientSearch, users]);

  const load = useCallback(async () => {
    const [reportRes, historyRes] = await Promise.all([
      fetch(`/api/daily-report?date=${date}`),
      fetch("/api/daily-report/history")
    ]);
    const reportData = await reportRes.json();
    const historyData = await historyRes.json();
    setReport(reportData.report);
    setHistory(historyData.history ?? []);
  }, [date]);

  useEffect(() => {
    load().catch(() => setMessage("No se pudo cargar el Reporte de Entrega Diaria."));
  }, [load]);

  useEffect(() => {
    if (!canSend) return;
    fetch("/api/users")
      .then((res) => res.ok ? res.json() : { users: [] })
      .then((data) => setUsers((data.users ?? []).filter((user: UserOption) => user.active)))
      .catch(() => setUsers([]));
  }, [canSend]);

  function openSendModal() {
    setSelectedReports([sheet]);
    setRecipientModal(true);
    setMessage("");
  }

  async function sendReport() {
    if (!canSend) return;
    const draftRecipients = recipientDraft.split(/[;,\s]+/).map((item) => item.trim().toLowerCase()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
    const targetRecipients = Array.from(new Set([...recipients, ...draftRecipients]));
    if (targetRecipients.length === 0) {
      setRecipientModal(true);
      setMessage("Agrega al menos un destinatario para enviar el reporte.");
      return;
    }
    if (selectedReports.length === 0) {
      setMessage("Selecciona al menos un reporte para enviar.");
      return;
    }
    setBusy(true);
    setMessage("");
    const results = await Promise.all(selectedReports.map(async (target) => {
      const res = await fetch(target === "resumen" ? "/api/summary-report/send" : "/api/daily-report/send", {
        method: "POST",
        headers,
        body: JSON.stringify(target === "resumen" ? { recipients: targetRecipients, observations } : { date, recipients: targetRecipients, observations })
      });
      const data = await res.json().catch(() => ({}));
      return { target, ok: res.ok, error: data.error as string | undefined };
    }));
    setBusy(false);
    setRecipients(targetRecipients);
    setRecipientDraft("");
    const failed = results.filter((result) => !result.ok);
      setMessage(failed.length === 0 ? "Reporte enviado y registrado en historial." : failed[0].error ?? "No se pudo enviar uno de los reportes.");
    if (failed.length === 0) setRecipientModal(false);
    await load();
  }

  function addRecipients() {
    const list = recipientDraft.split(/[;,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
    const valid = list.filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
    if (!valid.length) {
      setMessage("Ingresa al menos un correo valido.");
      return;
    }
    setRecipients((current) => Array.from(new Set([...current, ...valid])));
    setRecipientDraft("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) => current.filter((item) => item !== email));
  }

  function addUserRecipient(email: string) {
    setRecipients((current) => Array.from(new Set([...current, email.toLowerCase()])));
  }

  function selectSheet(nextSheet: "diario" | "resumen") {
    setSheet(nextSheet);
    setSelectedReports([nextSheet]);
    window.history.replaceState({}, "", `/diario?hoja=${nextSheet}`);
  }

  function toggleReportChoice(choice: ReportChoice) {
    setSelectedReports((current) => current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]);
  }

  function printCurrentSheet() {
    if (sheet === "resumen") {
      window.open("/api/summary-report/pdf", "_blank", "noopener,noreferrer");
      return;
    }
    window.open(`/api/daily-report/pdf?date=${date}`, "_blank", "noopener,noreferrer");
  }

  function toggleProject(project: string) {
    setExpandedProjects((current) => current.includes(project) ? current.filter((item) => item !== project) : [...current, project]);
  }

  function expandAllProjects() {
    setExpandedProjects((report?.projects ?? []).map((project) => project.project));
  }

  function collapseAllProjects() {
    setExpandedProjects([]);
  }

  async function resend(item: HistoryItem) {
    if (!canSend) return;
    const target = prompt("Destinatarios separados por coma", item.recipients.join(", "));
    if (!target) return;
    setBusy(true);
    const list = target.split(/[;,]/).map((value) => value.trim()).filter(Boolean);
    const res = await fetch(`/api/daily-report/history/${item.id}/resend`, {
      method: "POST",
      headers,
      body: JSON.stringify({ recipients: list })
    });
    setBusy(false);
    setMessage(res.ok ? "Reporte reenviado." : "No se pudo reenviar el reporte.");
    await load();
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--g1)]">
        <section className="border border-[var(--g2)] bg-white p-8">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <p className="mt-6 text-sm">Debes ingresar desde el tablero principal para ver el Reporte de Entrega Diaria.</p>
          <Link className="primary-button mt-4 inline-flex no-underline" href="/">Ir al login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="formatto-shell md:pl-[58px]">
      <SideNav role={role} />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g2)] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <div className="h-8 w-px bg-[var(--g2)]" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em]">Reportes</div>
            <div className="text-[10px] text-[var(--mut)]">Reporte de Entrega Diaria, Reporte de Entrega General, PDF, envio e historial</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="field w-auto" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="thin-button inline-flex items-center justify-center p-2" onClick={() => load()} title="Actualizar reportes"><RefreshCw size={16} /></button>
          <button className={`primary-button inline-flex items-center justify-center p-2 ${!canGenerate ? "pointer-events-none opacity-50" : ""}`} onClick={printCurrentSheet} title={sheet === "diario" ? "Descargar Reporte de Entrega Diaria" : "Descargar Reporte de Entrega General"}><Printer size={16} /></button>
          <button className="thin-button inline-flex items-center justify-center p-2" disabled={!canSend || busy} onClick={openSendModal} title="Enviar reportes por mail"><Mail size={16} /></button>
          <Link className="thin-button inline-flex items-center justify-center p-2 no-underline" href="/" title="Volver al tablero"><Home size={16} /></Link>
        </div>
      </header>

      {message && <div className="mx-6 mt-4 border-l-4 border-[var(--org)] bg-[#faece7] px-4 py-2 text-xs text-[#8b2500]">{message}</div>}

      <section className="px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-2 border border-[var(--g2)] bg-white p-2">
          <button className={`${sheet === "diario" ? "primary-button" : "thin-button"} inline-flex items-center gap-2`} onClick={() => selectSheet("diario")}><FileText size={14} />Reporte de Entrega Diaria</button>
          <button className={`${sheet === "resumen" ? "primary-button" : "thin-button"} inline-flex items-center gap-2`} onClick={() => selectSheet("resumen")}><ClipboardList size={14} />Reporte de Entrega General</button>
        </div>
        {sheet === "resumen" ? (
          <section className="border border-[var(--g2)] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g2)] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.06em]">Reporte de Entrega General</h2>
                <p className="text-xs text-[var(--mut)]">Vista general imprimible del tablero activo.</p>
              </div>
            </div>
            <iframe className="h-[calc(100vh-230px)] min-h-[720px] w-full border-0 bg-white" src="/reporte?embed=1" title="Reporte de Entrega General" />
          </section>
        ) : (
        <>
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
          <Metric label="Proyectos" value={report?.summary.activeProjects ?? 0} />
          <Metric label="Cumpl. hoy" value={`${report?.summary.dayProgress ?? 0}%`} />
          <Metric label="Completadas hoy" value={report?.summary.dayCompleted ?? 0} />
          <Metric label="Pendientes hoy" value={report?.summary.dayPending ?? 0} />
          <Metric label="Pendientes total" value={report?.summary.pending ?? 0} />
          <Metric label="Alertas" value={report?.summary.alerts ?? 0} />
        </div>

        <div className="mb-6">
          <section className="border border-[var(--g2)] bg-white">
            <div className="border-b border-[var(--g2)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.06em]">Estadisticas por proyecto</h2>
                  <p className="text-xs text-[var(--mut)]">Cumplimiento hoy = tareas programadas para la fecha que ya fueron despachadas. Cumplimiento total = tareas despachadas sobre el total del proyecto.</p>
                </div>
                <div className="flex gap-2">
                  <button className="thin-button" onClick={expandAllProjects}>Expandir todo</button>
                  <button className="thin-button" onClick={collapseAllProjects}>Colapsar todo</button>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[var(--g2)]">
              {(report?.projects ?? []).map((project) => {
                const expanded = expandedProjects.includes(project.project);
                const todayTasks = project.tasks.filter((task) => task.scheduledAt === report?.date);
                return (
                <article key={project.project} className="p-4">
                  <button className="grid w-full gap-3 text-left md:grid-cols-[1.2fr_120px_120px_120px_1fr]" onClick={() => toggleProject(project.project)}>
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        {project.project}
                      </div>
                      <div className={`mt-1 text-xs ${project.lateOpen ? "text-[var(--bad)]" : "text-[var(--mut)]"}`}>{project.status}</div>
                    </div>
                    <Metric label="Cumpl. hoy" value={`${project.dayProgress}%`} />
                    <Metric label="Cumpl. total" value={`${project.accumulatedProgress}%`} />
                    <Metric label="Pendientes" value={project.pending} />
                    <div className="text-xs text-[var(--mut)]">
                      <div>{project.observations}</div>
                      {project.alerts.map((alert) => <div key={alert} className="mt-1 text-[var(--bad)]">{alert}</div>)}
                    </div>
                  </button>
                  {expanded && (
                    <div className="mt-4 border border-[var(--g2)] bg-[var(--g1)] p-3">
                      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                        <Metric label="Tareas hoy" value={project.todayTotal} />
                        <Metric label="Desp. hoy" value={project.todayCompleted} />
                        <Metric label="Pend. hoy" value={project.todayPending} />
                        <Metric label="Atrasos" value={project.lateOpen} />
                        <Metric label="Pend. total" value={project.pending} />
                      </div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em]">Tareas programadas del dia</h3>
                      {todayTasks.length ? (
                        <div className="mb-4 overflow-x-auto border border-[var(--g2)] bg-white">
                          <TableHeader className="grid min-w-[900px] grid-cols-[1.3fr_120px_120px_105px_100px_105px_1fr]">
                            <div>Tarea</div><div>Responsable</div><div>Estado</div><div>F. prog.</div><div>Avance</div><div>Cumplimiento</div><div>Observaciones</div>
                          </TableHeader>
                          {todayTasks.map((task) => (
                            <div key={task.id} className="grid min-w-[900px] grid-cols-[1.3fr_120px_120px_105px_100px_105px_1fr] items-center border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                              <div>
                                <div className="font-semibold">{task.type} - {task.detail || "-"}</div>
                                <div className="text-[10px] text-[var(--mut)]">{task.units || "-"} uds</div>
                              </div>
                              <div>{task.responsible}</div>
                              <div><span className={`status-badge status-${task.state}`}>{task.state}</span></div>
                              <div>{displayDate(task.scheduledAt)}</div>
                              <div>{task.progress}</div>
                              <div className={task.state === "despachado" && task.variance && task.variance > 0 ? "text-[var(--bad)]" : "text-[var(--mut)]"}>{taskResult(task)}</div>
                              <div className="text-[var(--mut)]">{task.notes || project.observations}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-4 border border-[var(--g2)] bg-white p-3 text-xs text-[var(--mut)]">Este proyecto no tiene tareas programadas para la fecha seleccionada.</div>
                      )}
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em]">Tareas atrasadas abiertas</h3>
                      {project.lateTasks.length ? (
                        <div className="overflow-x-auto border border-[var(--g2)] bg-white">
                          <TableHeader className="grid min-w-[720px] grid-cols-[1.4fr_90px_100px_100px_1fr]">
                            <div>Tarea</div><div>Uds</div><div>F. prog.</div><div>Atraso</div><div>Notas</div>
                          </TableHeader>
                          {project.lateTasks.map((task) => (
                            <div key={task.id} className="grid min-w-[720px] grid-cols-[1.4fr_90px_100px_100px_1fr] border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                              <div className="font-semibold">{task.type} - {task.detail || "-"}</div>
                              <div>{task.units || "-"}</div>
                              <div>{displayDate(task.scheduledAt)}</div>
                              <div className="text-[var(--bad)]">{task.daysLate}d</div>
                              <div className="text-[var(--mut)]">{task.notes || "-"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--mut)]">Este proyecto no tiene tareas atrasadas abiertas.</div>
                      )}
                    </div>
                  )}
                </article>
              );})}
            </div>
          </section>

        </div>

        <section className="border border-[var(--g2)] bg-white">
          <div className="border-b border-[var(--g2)] px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.06em]">Historial de Reportes Enviados</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <TableHeader className="grid grid-cols-[140px_1fr_1fr_120px_150px]">
                <div>Fecha</div><div>Destinatarios</div><div>Proyectos</div><div>Estado</div><div></div>
              </TableHeader>
              {history.map((item) => (
                <div key={item.id} className="grid grid-cols-[140px_1fr_1fr_120px_150px] items-center border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                  <div>{displayDate(item.createdAt)}</div>
                  <div className="truncate">{item.recipients.join(", ")}</div>
                  <div className="truncate">{item.projects.join(", ")}</div>
                  <div><span className={`status-badge ${item.status === "enviado" ? "status-despachado" : "status-cambio"}`}>{item.status}</span></div>
                  <div className="flex justify-end gap-2">
                    <a className="thin-button p-2 no-underline" href={`/api/daily-report/history/${item.id}/pdf`} title="Descargar PDF"><Download size={13} /></a>
                    <button className="thin-button p-2" disabled={!canSend || busy} onClick={() => resend(item)} title="Reenviar"><RotateCw size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        </>
        )}
      </section>

      {recipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto border border-[var(--g2)] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.06em]">Enviar reportes por mail</h2>
                <p className="text-xs text-[var(--mut)]">Selecciona uno o ambos reportes. Si eliges ambos, se generan como archivos distintos.</p>
              </div>
              <button className="thin-button p-2" onClick={() => setRecipientModal(false)}><X size={14} /></button>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 border p-3 ${selectedReports.includes("diario") ? "border-[var(--org)] bg-[#faece7]" : "border-[var(--g2)] bg-white"}`}>
                <input type="checkbox" checked={selectedReports.includes("diario")} onChange={() => toggleReportChoice("diario")} />
                <FileText size={18} className="text-[var(--org)]" />
                <span>
                  <span className="block text-xs font-bold">Reporte de Entrega Diaria</span>
                  <span className="block text-[10px] text-[var(--mut)]">PDF formal de la fecha seleccionada.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 border p-3 ${selectedReports.includes("resumen") ? "border-[var(--org)] bg-[#faece7]" : "border-[var(--g2)] bg-white"}`}>
                <input type="checkbox" checked={selectedReports.includes("resumen")} onChange={() => toggleReportChoice("resumen")} />
                <ClipboardList size={18} className="text-[var(--org)]" />
                <span>
                  <span className="block text-xs font-bold">Reporte de Entrega General</span>
                  <span className="block text-[10px] text-[var(--mut)]">Resumen general del tablero activo.</span>
                </span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Correos</label>
                  <button className="thin-button inline-flex items-center gap-2 px-2 py-1" onClick={addRecipients}><Plus size={13} />Agregar escrito</button>
                </div>
                <textarea className="field min-h-[90px]" value={recipientDraft} onChange={(event) => setRecipientDraft(event.target.value)} placeholder="correos separados por coma" autoFocus />
                <div className="mt-3 min-h-[82px] border border-[var(--g2)] bg-[var(--g1)] p-2">
                  {recipients.length ? (
                    <div className="flex flex-wrap gap-2">
                      {recipients.map((email) => (
                        <span key={email} className="inline-flex items-center gap-2 border border-[var(--g2)] bg-white px-2 py-1 text-xs">
                          {email}
                          <button disabled={!canSend} onClick={() => removeRecipient(email)} title="Quitar destinatario"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 text-xs text-[var(--mut)]">Sin destinatarios agregados.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Usuarios del sistema</div>
                <input className="field mb-2" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Buscar nombre, correo, area o rol" />
                <div className="max-h-[218px] overflow-auto border border-[var(--g2)]">
                  {filteredUsers.map((user) => {
                    const selected = recipients.includes(user.email.toLowerCase());
                    return (
                      <button key={user.id} className={`flex w-full items-center justify-between gap-3 border-b border-[var(--g2)] px-3 py-2 text-left text-xs hover:bg-[var(--g1)] ${selected ? "bg-[#eef8f1]" : "bg-white"}`} onClick={() => addUserRecipient(user.email)}>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{user.fullName}</span>
                          <span className="block truncate text-[var(--mut)]">{user.email}</span>
                        </span>
                        <span className={`status-badge ${selected ? "status-despachado" : "status-pendiente"}`}>{selected ? "agregado" : user.role}</span>
                      </button>
                    );
                  })}
                  {users.length === 0 && <div className="p-3 text-xs text-[var(--mut)]">Sin usuarios disponibles.</div>}
                  {users.length > 0 && filteredUsers.length === 0 && <div className="p-3 text-xs text-[var(--mut)]">Sin coincidencias para la busqueda.</div>}
                </div>
              </div>
            </div>

            <label className="mb-1 mt-4 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Observaciones</label>
            <textarea className="field min-h-[80px]" value={observations} onChange={(event) => setObservations(event.target.value)} disabled={!canSend} />

            <div className="mt-4 flex justify-end gap-2">
              <button className="thin-button" onClick={() => setRecipientModal(false)}>Cancelar</button>
              <button className="primary-button inline-flex items-center gap-2" disabled={!canSend || busy || recipients.length === 0 || selectedReports.length === 0} onClick={sendReport}><Mail size={14} />Enviar</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
