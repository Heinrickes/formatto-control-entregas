export type AuditDetails = {
  state?: string;
  status?: { state?: string; actualAt?: string | null; completionDueAt?: string | null; notes?: string | null };
  actualAt?: string | null;
  completionDueAt?: string | null;
  completionTaskId?: string | null;
  notes?: string | null;
  type?: string;
  project?: string;
  scheduledAt?: string;
  units?: number;
  detail?: string | null;
  ids?: string[];
};

function asRecord(value: unknown): AuditDetails {
  return value && typeof value === "object" ? (value as AuditDetails) : {};
}

function displayDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}-${month}-${year}`;
  }
  return value;
}

export function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    actualizar_estado: "Cambio de estado",
    actualizar_estado_masivo: "Cambio masivo",
    crear_tarea: "Tarea creada",
    editar_tarea: "Tarea editada",
    eliminar_tarea: "Tarea eliminada",
    crear_usuario: "Usuario creado"
  };
  return labels[action] ?? action;
}

export function auditDetailLines(details: unknown) {
  const item = asRecord(details);
  const status = item.status ?? item;
  const lines: string[] = [];
  if (item.project) lines.push(`Proyecto: ${item.project}`);
  if (item.type) lines.push(`Tipo: ${item.type}`);
  if (item.detail) lines.push(`Detalle: ${item.detail}`);
  if (typeof item.units === "number") lines.push(`Unidades: ${item.units}`);
  if (item.scheduledAt) lines.push(`Fecha programada: ${displayDate(item.scheduledAt)}`);
  if (status.state) lines.push(`Estado: ${status.state}`);
  if (status.actualAt) lines.push(`Fecha real/propuesta: ${displayDate(status.actualAt)}`);
  if (status.completionDueAt) lines.push(`Compromiso completar: ${displayDate(status.completionDueAt)}`);
  if (status.notes) lines.push(`Notas: ${status.notes}`);
  if (item.completionTaskId) lines.push(`Tarea completamiento: ${item.completionTaskId}`);
  if (item.ids?.length) lines.push(`Tareas afectadas: ${item.ids.length}`);
  return lines.length ? lines : ["Sin detalle adicional."];
}

export function auditDetailText(details: unknown) {
  return auditDetailLines(details).join(" | ");
}
