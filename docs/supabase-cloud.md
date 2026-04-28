# Supabase Cloud para Formatto

Esta ruta deja la base de datos en Supabase Cloud. La app puede seguir corriendo en tu PC con Cloudflare Tunnel, o puede desplegarse luego en Vercel apuntando a la misma base.

## Ventaja practica

- Ya no dependes de Docker para la base de datos.
- La base queda disponible aunque reinicies la app.
- Permite desplegar en Vercel con mayor facilidad.
- Mantiene PostgreSQL/Supabase como stack principal.

## Conexion recomendada

Para Prisma usa la conexion de Supabase en modo **Session pooler** puerto `5432`. En Supabase se obtiene desde:

`Project Dashboard > Connect > Connection string > Session pooler`

Ejemplo:

```env
CLOUD_DATABASE_URL="postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

Supabase recomienda el pooler de sesion para clientes persistentes con IPv4. Para serverless puede usarse Transaction pooler `6543`, pero con Prisma hay que cuidar prepared statements; por eso esta primera version usa Session pooler.

## 1. Crear proyecto

1. Entra a Supabase y crea un proyecto nuevo.
2. Guarda bien la password de la base.
3. Copia la connection string de **Session pooler**.
4. En PowerShell, dentro del proyecto, define:

```powershell
$env:CLOUD_DATABASE_URL="postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

## 2. Crear tablas en Supabase Cloud

Ejecuta las migraciones Prisma contra Cloud:

```powershell
$env:DATABASE_URL=$env:CLOUD_DATABASE_URL
npm.cmd run cloud:migrate
```

## 3. Copiar datos locales a Cloud

Este comando reemplaza los datos del proyecto cloud con la informacion local actual.

```powershell
$env:LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$env:CONFIRM_CLOUD_COPY="YES"
npm.cmd run cloud:copy
```

## 4. Usar Cloud en la app local

Para probar la app local usando Supabase Cloud:

```powershell
$env:DATABASE_URL=$env:CLOUD_DATABASE_URL
npm.cmd run dev
```

## 5. Despliegue posterior en Vercel

Variables necesarias:

```env
DATABASE_URL="postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
FORMATTO_AUTH_SECRET="un-secreto-largo"
FORMATTO_USERS="admin@formatto.cl:clave:admin:Administrador Formatto,operador@formatto.cl:clave:operador:Operador Formatto,lector@formatto.cl:clave:lector:Lector Formatto"
```

La autenticacion actual es suficiente para una primera version privada. Mas adelante conviene migrarla a Supabase Auth para administrar usuarios desde el panel de Supabase.
