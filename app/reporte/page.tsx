import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { dayDiff, shortDate, toDateOnly } from "@/lib/dates";
import { SideNav } from "@/components/side-nav";
import { getCookieName, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: { programId?: string; embed?: string; print?: string } }) {
  const program = await prisma.program.findFirst({
    where: searchParams.programId ? { id: searchParams.programId } : { active: true },
    include: { dispatches: { include: { status: true }, orderBy: [{ project: "asc" }, { scheduledAt: "asc" }] } }
  });
  const session = verifySessionToken(cookies().get(getCookieName())?.value);
  const role = session?.role ?? "lector";
  const embedded = searchParams.embed === "1";
  const autoPrint = searchParams.print === "1";

  if (!program) {
    return <main className="p-8">No hay tablero activo.</main>;
  }

  const total = program.dispatches.length;
  const dispatched = program.dispatches.filter((row) => row.status?.state === "despachado").length;
  const partial = program.dispatches.filter((row) => row.status?.state === "parcial").length;
  const changes = program.dispatches.filter((row) => row.status?.state === "cambio").length;
  const pending = total - dispatched - partial - changes;
  const today = new Date();
  const urgent = program.dispatches
    .filter((row) => (row.status?.state ?? "pendiente") !== "despachado")
    .map((row) => ({ row, diff: dayDiff(row.scheduledAt, today) ?? 0 }))
    .filter((item) => item.diff >= 0 || Math.abs(item.diff) <= 3)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 20);

  const grouped = Array.from(
    program.dispatches.reduce((map, row) => {
      map.set(row.project, [...(map.get(row.project) ?? []), row]);
      return map;
    }, new Map<string, typeof program.dispatches>())
  ).map(([project, rows]) => {
    const projectTotal = rows.length;
    const projectDispatched = rows.filter((row) => row.status?.state === "despachado").length;
    const projectPartial = rows.filter((row) => row.status?.state === "parcial").length;
    const projectChanges = rows.filter((row) => row.status?.state === "cambio").length;
    const projectPending = projectTotal - projectDispatched - projectPartial - projectChanges;
    const openLate = rows.filter((row) => (row.status?.state ?? "pendiente") !== "despachado" && (dayDiff(row.scheduledAt, today) ?? 0) > 0).length;
    return {
      project,
      rows,
      total: projectTotal,
      dispatched: projectDispatched,
      partial: projectPartial,
      pending: projectPending,
      changes: projectChanges,
      openLate,
      completion: projectTotal ? Math.round((projectDispatched / projectTotal) * 100) : 0
    };
  }).sort((a, b) => b.openLate - a.openLate || b.pending - a.pending || a.project.localeCompare(b.project));

  return (
    <main className={`formatto-shell bg-white text-[12px] text-[var(--txt)] print:bg-white ${embedded ? "" : "md:pl-[58px] md:print:pl-0"}`}>
      {!embedded && <div className="print:hidden">
        <SideNav role={role} />
      </div>}
      <section className={`${embedded ? "p-6" : "mx-auto max-w-6xl p-8"} print:p-0`}>
        <div className="mb-8 flex items-center justify-between border-b border-[var(--g2)] pb-4">
          <Image src="/formatto-logo.png" alt="Formatto" width={170} height={30} />
          <div className="text-right">
            <h1 className="text-lg font-bold uppercase tracking-[0.06em]">Reporte de Entrega General</h1>
            <p className="text-[var(--mut)]">Emitido {toDateOnly(today)} - {program.name}</p>
            {!embedded && <div className="mt-2 print:hidden">
              <Link className="thin-button no-underline" href="/">Volver al tablero</Link>
            </div>}
          </div>
        </div>

        <section className="mb-6 grid grid-cols-6 gap-2">
          {[["Total", total], ["Despachados", dispatched], ["Parciales", partial], ["Pendientes", pending], ["Cambios", changes], ["Cumplimiento", `${total ? Math.round((dispatched / total) * 100) : 0}%`]].map(([label, value]) => (
            <div key={label} className="border border-[var(--g2)] border-t-[3px] border-t-[var(--org)] p-3">
              <div className="text-[9px] uppercase text-[var(--mut)]">{label}</div>
              <div className="text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase">Entregas urgentes</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-[var(--org)] bg-white text-left text-[var(--blk)]">
                <th className="p-2">Proyecto</th><th>Conjunto</th><th>Fecha</th><th>Estado tiempo</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {urgent.map(({ row, diff }) => (
                <tr key={row.id} className="border-b border-[var(--g2)]">
                  <td className="p-2 font-semibold">{row.project}</td>
                  <td>{row.type} - {row.detail ?? "-"}</td>
                  <td>{shortDate(row.scheduledAt)}</td>
                  <td>{diff > 0 ? `${diff}d atrasado` : diff === 0 ? "Hoy" : `${Math.abs(diff)}d por vencer`}</td>
                  <td>{row.status?.notes ?? ""}</td>
                </tr>
              ))}
              {urgent.length === 0 && (
                <tr><td className="p-2 text-[var(--mut)]" colSpan={5}>Sin entregas urgentes.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase">Detalle por proyecto</h2>
          <div className="space-y-5">
            {grouped.map((group) => (
              <article key={group.project} className="break-inside-avoid border border-[var(--g2)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g2)] bg-[var(--g1)] p-3">
                  <div>
                    <h3 className="text-base font-bold uppercase">{group.project}</h3>
                    <p className="text-[var(--mut)]">
                      {group.dispatched}/{group.total} despachadas - {group.partial} parciales - {group.pending} pendientes - {group.openLate} atrasos abiertos
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[["Cumpl.", `${group.completion}%`], ["Total", group.total], ["Parc.", group.partial], ["Pend.", group.pending], ["Atraso", group.openLate]].map(([label, value]) => (
                      <div key={label} className="min-w-[72px] border border-[var(--g2)] bg-white p-2">
                        <div className="text-[8px] uppercase text-[var(--mut)]">{label}</div>
                        <div className="text-sm font-bold">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y border-[var(--org)] bg-white text-left text-[var(--blk)]">
                      <th className="p-2">Conjunto</th><th>Uds</th><th>F. Prog.</th><th>F. Real</th><th>Desfase</th><th>Estado</th><th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const diff = row.status?.actualAt ? dayDiff(row.scheduledAt, row.status.actualAt) : dayDiff(row.scheduledAt, today);
                      const state = row.status?.state ?? "pendiente";
                      return (
                        <tr key={row.id} className="border-b border-[var(--g2)]">
                          <td className="p-2 font-semibold">{row.type} - {row.detail ?? "-"}</td>
                          <td>{row.units || "-"}</td>
                          <td>{shortDate(row.scheduledAt)}</td>
                          <td>{shortDate(row.status?.actualAt)}</td>
                          <td>{state === "despachado" ? (diff === 0 ? "En fecha" : `${diff}d`) : diff && diff > 0 ? `${diff}d atraso` : "Pendiente"}</td>
                          <td>{state}</td>
                          <td>{row.status?.notes ?? ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        </section>

        {autoPrint && <script dangerouslySetInnerHTML={{ __html: "window.print && setTimeout(() => window.print(), 400)" }} />}
      </section>
    </main>
  );
}
