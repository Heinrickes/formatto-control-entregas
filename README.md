# Formatto Control de Entregas

Aplicacion Next.js para control de entregas, despachos, reportes PDF, usuarios y bitacora de cambios de Formatto.

## Estado Actual

- App desplegada en Vercel.
- Base principal en Supabase Cloud, proyecto `formatto-erp`.
- Las tablas de este modulo viven en el schema `control_entregas`.
- El schema `public` queda reservado para Formatto ERP y no debe ser usado por esta app.
- Docker/Supabase local queda como respaldo de desarrollo, no como flujo principal.

## Variables Necesarias

Configurar en Vercel y en `.env.local` si se corre en el PC:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1&schema=control_entregas"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="SUPABASE_ANON_KEY"
FORMATTO_AUTH_SECRET="cambiar-por-un-secreto-largo"
FORMATTO_USERS=""
```

Importante: `DATABASE_URL` debe incluir siempre `schema=control_entregas`.

## Ejecutar Local Con Cloud

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run prisma:generate
npm.cmd run dev
```

Abrir:

```text
http://localhost:3000
```

## Despliegue

Repositorio:

```text
https://github.com/Heinrickes/formatto-control-entregas.git
```

Vercel:

```text
https://formatto-control-entregas.vercel.app
```

Validacion rapida:

```powershell
Invoke-WebRequest -UseBasicParsing https://formatto-control-entregas.vercel.app/api/health
```

Respuesta esperada:

```json
{"ok":true,"database":"up"}
```

## Supabase Cloud

El proyecto `formatto-erp` ya tiene datos del ERP en `public`. Control de Entregas esta aislado en:

```text
control_entregas
```

Comandos utiles:

```powershell
$env:DATABASE_URL=$env:CLOUD_DATABASE_URL
npm.cmd run cloud:migrate
```

```powershell
$env:LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$env:CONFIRM_CLOUD_COPY="YES"
npm.cmd run cloud:copy
```

La copia reemplaza solo las tablas del schema `control_entregas`, siempre que `CLOUD_DATABASE_URL` incluya `schema=control_entregas`.

## Docker Local

Docker/Supabase local puede seguir usandose como respaldo:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
```

```powershell
npx.cmd supabase start
npm.cmd run prisma:migrate
npm.cmd run dev
```

## Rutas Principales

- `/` tablero principal
- `/diario` reportes diarios y generales
- `/usuarios` administracion de usuarios
- `/bitacora` historial de cambios
- `/api/health` salud de app/base

## Seguridad

- No subir `.env`, `.env.local`, respaldos, logs ni reportes generados.
- Rotar la password de Supabase si fue compartida por chat o correo.
- Mantener `FORMATTO_DEV_ROLE` vacio en Vercel/produccion.
