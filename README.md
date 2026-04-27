# Formatto Control de Entregas

Aplicacion Next.js para migrar el HTML de control de despachos a una base PostgreSQL/Supabase local, manteniendo el estilo visual de Formatto.

## Ejecutar

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run prisma:generate
npm.cmd run dev
```

Abrir: http://localhost:3000

## Base de datos

La app espera Supabase local en:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
```

Cuando Supabase local este iniciado:

```powershell
npm.cmd run prisma:migrate
npm.cmd run seed:html -- "G:\Mi unidad\Formatto_Control_de_Entregas.html"
```

## Estado actual

- UI principal con dashboard, Gantt compacto, KPIs, filtros, modal de estado e historial.
- APIs CRUD para programas y despachos.
- Actualizacion de estados con roles basicos via encabezado `x-formatto-role`.
- Importacion Excel desde la UI.
- Exportacion CSV desde API/base de datos.
- Script de migracion desde el HTML original.
- Guia de infraestructura local, tunel y backups en `docs/infra-local.md`.

## Accesos locales

Configura usuarios en `.env` y `.env.local` mediante `FORMATTO_USERS`.
El formato es:

```env
FORMATTO_USERS="correo:rol:clave,correo:rol:clave"
```

Roles disponibles: `admin`, `operador`, `lector`.
