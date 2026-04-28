# Infraestructura local Formatto

## Objetivo

La aplicacion se publica por navegador y la base PostgreSQL queda privada. Los usuarios externos entran por HTTPS al sitio; nadie se conecta directo a PostgreSQL.

## Supabase local

1. Instalar Docker Desktop.
2. Instalar Supabase CLI.
3. Iniciar Supabase local:

```powershell
supabase init
supabase start
```

4. Copiar a `.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="valor-anon-local"
FORMATTO_DEV_ROLE="admin"
```

5. Crear tablas:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

6. Migrar el HTML actual:

```powershell
npm run seed:html -- "G:\Mi unidad\Formatto_Control_de_Entregas.html"
```

## Acceso por internet

Recomendado: Cloudflare Tunnel hacia `http://localhost:3000`.

Vercel no es la opcion recomendada para esta arquitectura si PostgreSQL/Supabase vive en tu PC y debe seguir privado. En Vercel, la API correria fuera de tu red y no podria llegar a `127.0.0.1:54322` sin exponer la base de datos. Para mantener PostgreSQL privado, publica solo la app web que corre en tu PC.

```powershell
cloudflared tunnel login
cloudflared tunnel create formatto-control
cloudflared tunnel route dns formatto-control entregas.tudominio.cl
cloudflared tunnel run formatto-control
```

No abrir el puerto 54322/PostgreSQL en el router. Solo publicar el puerto HTTP de la app mediante el tunel.

## GitHub

Desde PowerShell normal, en la carpeta del proyecto:

```powershell
cd "C:\Users\Enrique Arenas\Documents\New project"
git init
git add .
git commit -m "Initial Formatto control dashboard"
```

Luego crear un repositorio vacio en GitHub y copiar su URL. Ejemplo:

```powershell
git branch -M main
git remote add origin https://github.com/TU_USUARIO/formatto-control-entregas.git
git push -u origin main
```

No subir `.env` ni `.env.local`; ya estan ignorados por `.gitignore`.

## Servir la app en la PC

```powershell
npm run build
npm run start
```

Para dejarla permanente, crear una tarea de Windows o usar NSSM/PM2 apuntando a `npm run start`.

Este proyecto incluye scripts para Programador de tareas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-startup-tasks.ps1
Start-ScheduledTask -TaskName "Formatto Control App"
Start-ScheduledTask -TaskName "Formatto Control Tunnel"
```

Nota: `start-formatto-tunnel.cmd` usa el tunel rapido de Cloudflare, por lo que la URL puede cambiar. Para URL fija, usar named tunnel con dominio propio.

Si Windows bloquea el Programador de tareas, usar accesos directos en Inicio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-startup-shortcuts.ps1
```

## Backup

Definir `DATABASE_URL` y ejecutar:

```powershell
npm run backup:db
```

Programar el script `scripts/backup-db.ps1` en el Programador de tareas de Windows una vez al dia.
