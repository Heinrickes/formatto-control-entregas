# Migracion a Codex Empresa - Control de Entregas Formatto

Fecha de preparacion: 2026-06-02

Este documento resume todo lo necesario para traspasar el proyecto a un entorno Codex Empresa o a un nuevo equipo tecnico sin depender del historial completo del chat.

## 1. Identificacion del proyecto

- Nombre funcional: Control de Entregas - Formatto.
- Carpeta local actual: `C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto`.
- Repositorio GitHub: `https://github.com/Heinrickes/formatto-control-entregas.git`.
- Rama principal: `master`.
- Deploy productivo: `https://formatto-control-entregas.vercel.app`.
- Vercel project name: `formatto-control-entregas`.
- Vercel projectId: `prj_3x6KMOHA3nHwSvFz82ssrzXh3B9S`.
- Vercel org/teamId: `team_xNbv6Rbz19BOtdmTAlokRm8T`.
- Base de datos: Supabase Cloud/PostgreSQL, esquema Prisma `control_entregas`.

## 2. Estado actual del codigo

Ultimos commits relevantes:

- `4f8f153 agrega fecha original congelada`
- `4f5d24b actualizacion boton refresh`
- `7fe3955 asegura refresco al completar despacho`
- `8d3e3e3 separa reprogramacion de resultado`
- `2c00a5c reprograma fecha al marcar cambio`

Antes de continuar en Codex Empresa, ejecutar:

```powershell
git status
git pull origin master
npm.cmd install
npm.cmd run build
```

Si Windows bloquea el DLL de Prisma:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; npm.cmd run build
```

## 3. Stack tecnico

- Next.js 14 App Router.
- React 18.
- TypeScript.
- Tailwind CSS.
- Prisma 5.
- PostgreSQL/Supabase Cloud.
- Vercel.
- `xlsx` para importacion Excel.
- PDF/reportes implementados desde rutas API.
- Outlook local/PowerShell para correo en localhost.

## 4. Scripts principales

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run start
npm.cmd run cloud:migrate
npm.cmd run prisma:generate
npm.cmd run deploy:vercel
npm.cmd run vercel:pull
npm.cmd run vercel:mail
npm.cmd run seed:users
npm.cmd run backup:db
```

Notas:

- `npm.cmd run prisma:migrate` usa `prisma migrate dev`; no usar contra Supabase Cloud salvo que se necesite desarrollo interactivo.
- Para Supabase Cloud usar `npm.cmd run cloud:migrate`.
- `npm.cmd run deploy:vercel` despliega a produccion desde la carpeta local.

## 5. Variables de entorno necesarias

No pegar valores secretos en chats ni documentos. Usar `.env.example` como plantilla.

Variables requeridas:

```text
DATABASE_URL
CLOUD_DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
FORMATTO_AUTH_SECRET
FORMATTO_USERS
FORMATTO_ACCESS_SECRET
FORMATTO_APP_URL
FORMATTO_MAIL_FROM
RESEND_API_KEY
```

Estado recomendado:

- `DATABASE_URL` y `CLOUD_DATABASE_URL` deben apuntar al pooler de Supabase con:
  - `sslmode=require`
  - `pgbouncer=true`
  - `connection_limit=1`
  - `schema=control_entregas`
- `FORMATTO_APP_URL` debe apuntar a `https://formatto-control-entregas.vercel.app`.
- `RESEND_API_KEY` puede existir, pero el envio por Resend esta pausado hasta verificar DNS de `formatto.cl`.
- El envio de correos productivo desde Vercel esta pendiente de decision: verificar dominio en Resend o implementar Microsoft Graph.

## 6. Base de datos y migraciones

Prisma schema:

```text
prisma/schema.prisma
```

Migraciones aplicadas:

```text
20260427151122_init_formatto
20260428113000_profile_users
20260428160000_report_delivery
20260428202653_add_presence_audit
20260429204119_partial_dispatch_status
20260504120000_add_business_line
20260504133000_add_dispatch_description
20260505100000_add_production_tracking
20260505113000_add_project_type
20260506100000_add_user_access_secrets
20260508100000_add_original_scheduled_at
```

Modelos principales:

- `Profile`: usuarios, roles, area, cargo, password hash, estado activo.
- `UserAccessSecret`: historial cifrado de claves administradas.
- `UserPresence`: actividad/presencia.
- `AuditLog`: bitacora administrativa.
- `Program`: tablero/programa.
- `Dispatch`: tareas/despachos.
- `DispatchStatus`: estado actual.
- `DispatchEvent`: historial de estados.
- `ReportDelivery`: historial de reportes enviados.

Regla nueva importante:

- `Dispatch.originalScheduledAt` es la fecha original congelada.
- `Dispatch.scheduledAt` es la fecha vigente/reprogramada.
- El estado `cambio` modifica `scheduledAt`, pero no debe contar como resultado real.
- El resultado de despacho se calcula contra `originalScheduledAt`.
- Si una tarea ya habia sido cambiada antes de la migracion `20260508100000_add_original_scheduled_at`, la fecha congelada quedo igual a la fecha vigente que tenia en ese momento. Esas tareas deben corregirse manualmente desde Editar tarea si se necesita reconstruir la fecha inicial real.

## 7. Funcionalidad principal

Modulos:

- Dashboard principal.
- Control de Despacho.
- Entregas Urgentes.
- Control de Tareas.
- Usuarios.
- Bitacora.
- Reporte diario.
- Reporte general.
- Importador Excel.
- Exportacion/reporte PDF.

Roles:

- `admin`: administra usuarios, tareas, fechas, estados, reportes.
- `operador`: actualiza estados operativos y produccion.
- `lector`: solo visualiza.

Estados de despacho:

- `pendiente`
- `parcial`
- `despachado`
- `cambio`

Estados de produccion:

- `Plan`
- `Corte`
- `Enchape`
- `Perforado`
- `Consolidado`
- `Embalaje`
- `Armado`
- `CD`

Rutas productivas:

- RTA: `Plan -> Corte -> Enchape -> Perforado -> Consolidado -> Embalaje -> CD`
- ARMADO: `Plan -> Corte -> Enchape -> Perforado -> Consolidado -> Armado -> CD`

## 8. Archivos clave

Frontend principal:

```text
app/page.tsx
components/side-nav.tsx
lib/client-types.ts
lib/validators.ts
lib/formatting.ts
lib/dates.ts
```

Autenticacion y roles:

```text
app/api/auth/login/route.ts
app/api/auth/logout/route.ts
lib/auth.ts
lib/rbac.ts
```

Despachos:

```text
app/api/dashboard/route.ts
app/api/dispatches/[id]/route.ts
app/api/dispatches/[id]/status/route.ts
app/api/dispatches/[id]/production/route.ts
app/api/dispatches/bulk-status/route.ts
app/api/programs/route.ts
app/api/programs/[id]/dispatches/route.ts
```

Usuarios y claves:

```text
app/usuarios/page.tsx
app/api/users/route.ts
app/api/users/[id]/route.ts
app/api/users/[id]/send-access/route.ts
app/api/users/access-secrets/route.ts
lib/user-access-mail.ts
lib/outlook-mail.ts
```

Reportes:

```text
app/diario/page.tsx
app/reporte/page.tsx
app/api/daily-report/route.ts
app/api/daily-report/pdf/route.ts
app/api/daily-report/send/route.ts
app/api/summary-report/pdf/route.ts
app/api/summary-report/send/route.ts
lib/daily-report.ts
lib/summary-report.ts
```

Bitacora:

```text
app/bitacora/page.tsx
app/api/audit/route.ts
app/api/audit/pdf/route.ts
lib/audit.ts
```

Infraestructura:

```text
prisma/schema.prisma
prisma/migrations/
scripts/deploy-vercel.cmd
scripts/configure-vercel-mail.ps1
scripts/backup-db.ps1
```

## 9. Rutas API disponibles

```text
/api/health
/api/dashboard
/api/programs
/api/programs/[id]
/api/programs/[id]/dispatches
/api/dispatches/[id]
/api/dispatches/[id]/status
/api/dispatches/[id]/production
/api/dispatches/bulk-status
/api/dispatches/import
/api/users
/api/users/[id]
/api/users/[id]/send-access
/api/users/access-secrets
/api/audit
/api/audit/pdf
/api/daily-report
/api/daily-report/pdf
/api/daily-report/send
/api/daily-report/history
/api/daily-report/history/[id]/pdf
/api/daily-report/history/[id]/resend
/api/summary-report/pdf
/api/summary-report/send
/api/export
/api/presence
```

## 10. Validaciones minimas para el nuevo entorno

Local:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run dev
```

Health:

```powershell
curl.exe http://localhost:3000/api/health
```

Produccion:

```powershell
curl.exe https://formatto-control-entregas.vercel.app/api/health
curl.exe https://formatto-control-entregas.vercel.app/api/programs
```

Respuesta esperada de health:

```json
{"ok":true,"database":"up"}
```

## 11. Checklist de migracion a Codex Empresa

1. Dar acceso al repositorio GitHub `Heinrickes/formatto-control-entregas`.
2. Dar acceso al proyecto Vercel `formatto-control-entregas`.
3. Dar acceso al proyecto Supabase Cloud `formatto-erp`.
4. Entregar variables de entorno por canal seguro, no en chat.
5. Confirmar que `DATABASE_URL` apunta al schema `control_entregas`.
6. Ejecutar `npm.cmd install`.
7. Ejecutar `npm.cmd run prisma:generate`.
8. Ejecutar `npm.cmd run build`.
9. Ejecutar `npm.cmd run cloud:migrate` solo si hay migraciones nuevas pendientes.
10. Verificar `/api/health`.
11. Abrir la app local y validar login admin.
12. Validar en Vercel con `Ctrl+F5`.
13. Probar editar tarea, marcar cambio, marcar despachado y usar boton actualizar.
14. Probar una tarea con fecha original congelada distinta a la fecha vigente.
15. Probar importacion Excel con pocas filas antes de una carga real.

## 12. Flujos criticos que no se deben romper

### Cambio de fecha

- `cambio` debe reprogramar `scheduledAt`.
- `cambio` no debe llenar Resultado.
- `originalScheduledAt` no debe cambiar automaticamente al reprogramar.

### Despacho completo

- `despachado` guarda `DispatchStatus.actualAt`.
- Resultado se calcula contra `originalScheduledAt`.
- Si existe reprogramacion, el modal debe mostrar fecha original y fecha vigente.
- La app puede preguntar si se marca produccion en `CD`.

### Edicion admin

- Admin puede editar fecha vigente.
- Admin puede corregir fecha original congelada.
- La correccion de fecha original queda en `AuditLog`.

### Boton actualizar

- Debe recargar programas y dashboard.
- Debe refrescar tambien la fila seleccionada si hay modal abierto.

### Correos

- Localhost: Outlook local via PowerShell/COM.
- Vercel: correo productivo pendiente hasta resolver dominio `formatto.cl` o Microsoft Graph.

## 13. Pendientes abiertos

- Resolver envio de correos productivo en Vercel:
  - opcion A: verificar DNS de `formatto.cl` en Resend.
  - opcion B: Microsoft Graph para enviar desde el buzon corporativo.
- Revisar tareas ya reprogramadas antes de `originalScheduledAt` y corregir fecha congelada si corresponde.
- Definir respaldo automatico programado de Supabase Cloud.
- Evaluar sacar `.env` del paquete de deploy si se decide administrar 100% por Vercel env vars.
- Revisar si `FORMATTO_USERS` debe quedar solo como emergencia o eliminarse.
- Documentar plantilla Excel definitiva para cargas masivas.

## 14. Instruccion para el Codex receptor

Al iniciar en Codex Empresa:

1. Leer este documento.
2. Leer `CONTEXTO_PARA_NUEVO_CHAT.md`.
3. Ejecutar `git status`.
4. Ejecutar `npm.cmd run build`.
5. No exponer secretos.
6. No borrar tablas del proyecto `formatto-erp`.
7. Mantener todos los cambios con commit y push a `master`, salvo que el equipo defina ramas.
8. Antes de deploy, confirmar que migraciones Prisma necesarias ya fueron aplicadas.

