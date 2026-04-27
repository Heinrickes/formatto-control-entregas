import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { dayDiff, shortDate, toDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: { programId?: string } }) {
  const program = await prisma.program.findFirst({
    where: searchParams.programId ? { id: searchParams.programId } : { active: true },
    include: { dispatches: { include: { status: true }, orderBy: [{ scheduledAt: "asc" }, { project: "asc" }] } }
  });

  if (!program) {
    return <main className="p-8">No hay tablero activo.</main>;
  }

  const total = program.dispatches.length;
  const dispatched = program.dispatches.filter((row) => row.status?.state === "despachado").length;
  const changes = program.dispatches.filter((row) => row.status?.state === "cambio").length;
  const pending = total - dispatched - changes;
  const today = new Date();
  const urgent = program.dispatches
    .filter((row) => (row.status?.state ?? "pendiente") !== "despachado")
    .map((row) => ({ row, diff: dayDiff(row.scheduledAt, today) ?? 0 }))
    .filter((item) => item.diff >= 0 || Math.abs(item.diff) <= 3)
    .slice(0, 20);

  return (
    <main className="mx-auto max-w-5xl bg-white p-8 text-[12px] text-[var(--txt)] print:p-0">
      <div className="mb-8 flex items-center justify-between border-b border-[var(--g2)] pb-4">
        <Image src="/formatto-logo.png" alt="Formatto" width={170} height={30} />
        <div className="text-right">
          <h1 className="text-lg font-bold uppercase tracking-[0.06em]">Reporte de entregas</h1>
          <p className="text-[var(--mut)]">Emitido {toDateOnly(today)} · {program.name}</p>
        </div>
      </div>
      <section className="mb-6 grid grid-cols-5 gap-2">
        {[["Total", total], ["Despachados", dispatched], ["Pendientes", pending], ["Cambios", changes], ["Cumplimiento", `${total ? Math.round((dispatched / total) * 100) : 0}%`]].map(([label, value]) => (
          <div key={label} className="border border-[var(--g2)] border-t-[3px] border-t-[var(--org)] p-3">
            <div className="text-[9px] uppercase text-[var(--mut)]">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase">Entregas urgentes</h2>
        <table className="w-full border-collapse">
          <thead><tr className="bg-[var(--blk)] text-left text-white"><th className="p-2">Proyecto</th><th>Conjunto</th><th>Fecha</th><th>Estado tiempo</th><th>Notas</th></tr></thead>
          <tbody>
            {urgent.map(({ row, diff }) => (
              <tr key={row.id} className="border-b border-[var(--g2)]">
                <td className="p-2 font-semibold">{row.project}</td>
                <td>{row.type} · {row.detail ?? "-"}</td>
                <td>{shortDate(row.scheduledAt)}</td>
                <td>{diff > 0 ? `${diff}d atrasado` : diff === 0 ? "Hoy" : `${Math.abs(diff)}d por vencer`}</td>
                <td>{row.status?.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase">Detalle de tareas</h2>
        <table className="w-full border-collapse">
          <thead><tr className="bg-[var(--blk)] text-left text-white"><th className="p-2">Proyecto</th><th>Conjunto</th><th>Uds</th><th>F. Prog.</th><th>F. Real</th><th>Desfase</th><th>Estado</th></tr></thead>
          <tbody>
            {program.dispatches.map((row) => {
              const diff = row.status?.actualAt ? dayDiff(row.scheduledAt, row.status.actualAt) : dayDiff(row.scheduledAt, today);
              const state = row.status?.state ?? "pendiente";
              return (
                <tr key={row.id} className="border-b border-[var(--g2)]">
                  <td className="p-2 font-semibold">{row.project}</td>
                  <td>{row.type} · {row.detail ?? "-"}</td>
                  <td>{row.units || "-"}</td>
                  <td>{shortDate(row.scheduledAt)}</td>
                  <td>{shortDate(row.status?.actualAt)}</td>
                  <td>{state === "despachado" ? (diff === 0 ? "En fecha" : `${diff}d`) : diff && diff > 0 ? `${diff}d atraso` : "Pendiente"}</td>
                  <td>{state}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <script dangerouslySetInnerHTML={{ __html: "window.print && setTimeout(() => window.print(), 400)" }} />
    </main>
  );
}
