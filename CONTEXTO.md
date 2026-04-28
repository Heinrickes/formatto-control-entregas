# Contexto del Proyecto: Control de Entregas - Formatto

Fecha de contexto: 2026-04-28

## Objetivo

Migrar y mejorar la aplicacion original `Formatto_Control_de_Entregas.html` hacia una app web con base de datos, manteniendo la identidad visual Formatto y mejorando CRUD, control de estados, KPIs, timeline, usuarios y acceso externo temporal.

## Ubicacion actual

Carpeta principal:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto
```

Acceso directo de escritorio:

```text
Control de Entregas
```

La carpeta anterior `New project` quedo obsoleta/residual. La ruta valida es la carpeta nueva.

## Stack actual

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL via Supabase local
- Docker Desktop
- Cloudflare Tunnel rapido con `cloudflared.exe`
- Outlook local para envio automatico del enlace temporal

## Base de datos

Actualmente la base es Supabase local, levantada con Docker.

Conexion local:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Importante:

- Si Docker Desktop esta apagado, la app puede abrir, pero la base queda `down`.
- Para que el tablero funcione hoy, Docker/Supabase local deben estar activos.
- Se dejo documentada la ruta futura a Supabase Cloud en `docs/supabase-cloud.md`.

## Modelo principal

Tablas Prisma:

- `Profile`: usuarios, roles, area, cargo, password hash, estado activo.
- `Program`: tablero/programa principal.
- `Dispatch`: tareas/despachos.
- `DispatchStatus`: estado actual de cada despacho.
- `DispatchEvent`: historial de cambios de estado.

Roles:

- `admin`: administra tareas, estados, usuarios.
- `operador`: actualiza estados.
- `lector`: visualiza informacion.

## Usuarios cargados

Se cargo la base inicial desde `PROMPT CREACION DE USUARIOS - FORMA.txt`.

Resumen:

- 19 usuarios creados.
- 4 admin.
- 2 operadores.
- 13 lectores.

Correccion aplicada:

```text
David Elgueta -> david.elgueta@formatto.cl
```

Credenciales iniciales principales:

```text
Enrique Arenas
Usuario: enrique.arenas@formatto.cl
Clave: Plan01
Rol: admin

David Reyes
Usuario: david.reyes@formatto.cl
Clave: Plan02
Rol: admin
```

Las claves estan guardadas como hash `scrypt` en base de datos.

## Login

El login ahora:

- Usa usuarios reales desde `Profile`.
- Abre con campos vacios por defecto.
- Tiene boton de ojo para mostrar/ocultar clave.
- Mantiene cookie HTTP-only firmada.
- Tiene respaldo opcional por `.env` usando `FORMATTO_USERS`, pero el flujo normal usa base de datos.

## Gestion de usuarios

En la app, el usuario `admin` ve el boton:

```text
Usuarios
```

Desde ahi se puede:

- Crear usuario.
- Editar nombre, correo, rol, area y cargo.
- Cambiar clave.
- Activar/desactivar usuario.
- Generar clave inicial por area si se deja la clave vacia.

Areas soportadas:

- Planificacion y Adquisiciones -> `Plan`
- Produccion -> `Prod`
- Armado -> `Arma`
- Logistica -> `Logi`
- Gerencia -> `Geren`
- Instalaciones -> `Insta`

## Dashboard y CRUD

La app tiene un solo tablero principal.

Funciones implementadas:

- Agregar tarea manual.
- Importar tareas desde Excel.
- Editar tarea.
- Eliminar tarea.
- Actualizar estado individual.
- Actualizar estados masivamente.
- Historial de cambios de estado por tarea.
- Exportar reporte imprimible/enviable.

Estados:

- `pendiente`
- `despachado`
- `cambio`

## KPIs y logica operativa

Se implemento logica gerencial:

- Cumplimiento separado en:
  - On time
  - Atraso
  - Adelanto
- Adelantado no se mezcla con on time.
- Una tarea atrasada hace que el proyecto suba prioridad y se marque rojo.
- Despachos completados salen de urgencia.
- Agrupacion por proyecto.
- Proyectos colapsables.
- Seleccion masiva por proyecto.
- Orden natural operativo:
  1. Atrasados pendientes.
  2. Proximos despachos / hoy.
  3. Pendientes futuros.
  4. Despachados adelantados.
  5. Despachados on time.

## Timeline

El timeline:

- Usa dias habiles laborales.
- Se centra en el dia actual.
- Muestra ventana navegable alrededor de hoy.
- Se corrigio para que no quede fijo en `2026-04-27`.
- Ahora calcula "Hoy" dinamicamente con zona horaria Chile.

Zona horaria:

```text
America/Santiago
```

Si la app queda abierta desde el dia anterior, conviene refrescar Chrome con:

```text
Ctrl + F5
```

## Acceso externo temporal

Se usa Cloudflare Tunnel rapido.

Ejecutable local:

```text
scripts\cloudflared.exe
```

El enlace cambia cada vez que se reinicia el tunel.

Ejemplo de URL:

```text
https://xxxxx.trycloudflare.com
```

## Acceso directo diario

El acceso directo del escritorio **Control de Entregas** ejecuta:

```text
scripts\start-formatto-dev-tunnel-mail.cmd
```

Ese comando llama a:

```text
scripts\start-formatto-dev-tunnel-mail.ps1
```

Flujo del doble click:

1. Revisa si Docker esta corriendo.
2. Si Docker esta apagado, abre Docker Desktop.
3. Espera hasta 3 minutos a que Docker responda.
4. Levanta Supabase local con `npx.cmd supabase start`.
5. Revisa si `localhost:3000` ya esta ocupado.
6. Si la app ya esta corriendo, no abre otro servidor.
7. Si no esta corriendo, ejecuta `npm.cmd run dev`.
8. Abre Chrome en `http://localhost:3000`.
9. Cierra tuneles `cloudflared` previos para evitar links viejos.
10. Levanta un nuevo Cloudflare Tunnel.
11. Detecta la URL temporal.
12. Envia correo automatico por Outlook.

## Correo automatico

Destinatario:

```text
david.reyes@formatto.cl
```

Remitente esperado:

```text
enrique.arenas@formatto.cl
```

El correo incluye:

- Texto visible del enlace:

```text
Control de Entregas - Formatto
```

- Por detras apunta a la URL temporal real de Cloudflare.
- Usuario y clave de David Reyes.
- Firma configurada en Outlook, si Outlook la carga correctamente.

Si Outlook bloquea el envio automatico, el script abre un correo preparado como respaldo.

## Logs del tunel

Archivos de diagnostico:

```text
cloudflared-tunnel.log
cloudflared-tunnel-error.log
```

Si un log esta bloqueado, el script crea uno nuevo con timestamp para no fallar.

## Scripts importantes

```text
scripts\start-formatto-dev-tunnel-mail.cmd
scripts\start-formatto-dev-tunnel-mail.ps1
scripts\start-formatto-dev-tunnel.cmd
scripts\start-formatto-app.cmd
scripts\start-formatto-tunnel.cmd
scripts\seed-users.mjs
scripts\migrate-from-html.mjs
scripts\copy-db-to-cloud.mjs
scripts\backup-db.ps1
scripts\rename-project-folder.ps1
```

## Comandos utiles

Levantar app manual:

```powershell
npm.cmd run dev
```

Revisar salud:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
```

Levantar Supabase local:

```powershell
npx.cmd supabase start
```

Migrar Prisma local:

```powershell
npm.cmd run prisma:migrate
```

Cargar usuarios iniciales:

```powershell
npm.cmd run seed:users
```

Validar codigo:

```powershell
npm.cmd run lint
npm.cmd run build
```

## Validaciones realizadas

Se validaron en distintas etapas:

- `npm.cmd run lint` OK.
- `npm.cmd run build` OK.
- `/api/health` OK con base arriba.
- Login Enrique OK.
- Login David Reyes OK.
- Migracion Prisma de usuarios aplicada.
- Seed de usuarios aplicado.
- Acceso directo actualizado a carpeta nueva.
- App levantando desde `Control de Entregas - Formatto`.

## Pendientes recomendados

1. Migrar base a Supabase Cloud para no depender de Docker local.
2. Pasar despliegue a Vercel o mantener Cloudflare Tunnel segun decision operacional.
3. Implementar cambio obligatorio de password en primer login.
4. Mejorar gestion de passwords para no enviar claves por correo en etapa productiva.
5. Crear respaldo diario automatizado de PostgreSQL local mientras se siga usando Docker.
6. Limpiar carpeta residual `New project` cuando ya no se necesite.
7. Hacer commit de los cambios nuevos en GitHub.

