# Resumen de Trabajo - Control de Entregas Formatto

Fecha de resumen: 29-04-2026  
Carpeta valida del proyecto:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto
```

## Estado General

La aplicacion original en HTML/localStorage fue migrada a una app web con Next.js, React, TypeScript, Prisma y Supabase local sobre Docker. La app mantiene la identidad visual de Formatto, con foco en control de despachos, estados, atrasos, cumplimiento y reportes.

La app se ejecuta localmente en:

```text
http://localhost:3000
```

La base local esta en Supabase/Docker con PostgreSQL. Los usuarios acceden por navegador a la app, no directamente a PostgreSQL.

## Infraestructura Local

Se instalo y configuro Docker Desktop y Supabase local. Hubo problemas iniciales con WSL, permisos de Docker y el daemon detenido, pero se corrigio el flujo de arranque.

El `project_id` de Supabase fue cambiado de:

```text
New_project
```

a:

```text
control_entregas_formatto
```

Esto ordena el nombre visible de los contenedores en Docker Desktop.

Se hizo respaldo antes del cambio:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto\backups\public-data-20260429-133841.sql
```

Luego se levanto Supabase con el nuevo nombre y se restauraron datos. Conteos validados:

- 19 usuarios
- 66 despachos
- 66 estados
- 1 programa

## Acceso Directo y Arranque

Existe un acceso directo en el escritorio:

```text
Control de Entregas
```

Apunta a:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto\scripts\start-formatto-dev-tunnel-mail.cmd
```

El script realiza:

- Verificacion de Docker.
- Intento de apertura de Docker Desktop si no esta corriendo.
- Espera de Docker hasta que el daemon responda.
- Inicio de Supabase local.
- Inicio de Next.js en `localhost:3000` si no esta corriendo.
- Apertura de Chrome.
- Inicio de Cloudflare quick tunnel.
- Envio automatico del link temporal por Outlook.

Se corrigio el script para:

- No depender del archivo bloqueado `C:\Users\Enrique Arenas\.docker\config.json`.
- Usar configuracion local `.docker-cli`.
- Detectar correctamente si Docker esta listo.
- Intentar abrir Docker Desktop visible.
- Solicitar elevacion si Docker necesita permisos de administrador.

Archivo relacionado:

```text
scripts\start-formatto-dev-tunnel-mail.ps1
```

## Cloudflare Tunnel

Se usa por ahora un tunnel rapido de Cloudflare hacia:

```text
http://localhost:3000
```

El link temporal se envia por correo. El nombre visible del enlace en el correo debe ser:

```text
Control de Entregas - Formatto
```

Aunque por detras use la URL temporal `trycloudflare.com`.

Pendiente futuro:

- Pasar a named tunnel.
- Usar dominio definitivo:

```text
entregas.formatto.cl
```

## GitHub

Repositorio remoto configurado:

```text
https://github.com/Heinrickes/formatto-control-entregas.git
```

Hay cambios pendientes sin commit al momento del resumen. Revisar:

```powershell
git status
```

## Usuarios y Roles

Se implemento login con roles:

- `admin`: administra usuarios, programas, tareas y cambios.
- `operador`: puede actualizar estados y operar despachos.
- `lector`: solo visualiza informacion e historial.

Se agrego gestion de usuarios y perfiles. Tambien se agrego ojo para ver clave en login.

Usuarios importados/creados desde el prompt de usuarios:

- Enrique Arenas
- David Reyes
- Karol Jorquera
- Paola Cornejo
- Braulio Contreras
- Luis Venegas
- David Elgueta
- Carlos Nunez
- Paul Sepulveda
- Jorge Troncoso
- Claudia Munoz
- Pablo Dittborn
- Christian San Martin
- Victor Moreno
- Ana Guerrero
- Jose Rojas
- Robinson Bello
- Marcos Catalan
- Pablo Ponce

## Modelo de Datos

Tablas principales implementadas con Prisma:

- `Profile`
- `Program`
- `Dispatch`
- `DispatchStatus`
- `DispatchEvent`
- `ReportDelivery`
- `UserPresence`
- `AuditLog`

El historial de cambios de estado queda registrado en `DispatchEvent` y tambien hay bitacora general en `AuditLog`.

## Dashboard Principal

Se evoluciono el dashboard a un panel gerencial y operativo.

Elementos actuales:

- KPIs superiores.
- Panel de Control de Despacho.
- Panel de Entregas Urgentes.
- Panel de Control de Tareas.
- Panel lateral derecho con filtros, resumen operativo y foco por proyecto.
- Agrupacion por proyecto.
- Expandir y colapsar proyectos.
- Seleccion masiva de tareas.
- Orden natural por prioridad.

Logica de prioridad:

1. Atrasado.
2. Proximos despachos / tareas pendientes relevantes.
3. Adelantados.
4. Entregados on time.

Regla importante:

Si un proyecto tiene una sola tarea atrasada, el proyecto sube en la lista y debe verse en rojo. La prioridad es minimizar atrasos.

## KPIs

Se separaron indicadores:

- Total de tareas.
- Total de proyectos.
- Despachados.
- Pendientes.
- Atraso.
- On time.
- Adelanto.

La suma conceptual de:

```text
atraso + on time + adelanto + pendiente = total de tareas
```

Cada KPI muestra porcentaje y cantidad.

## Fechas

Se corrigieron problemas de fecha del timeline y tabla.

La fecha operativa se maneja en zona local America/Santiago. Se pidio que el sistema avance diariamente:

- 28-04-2026
- 29-04-2026
- etc.

Tambien se ajusto la logica para considerar dias habiles laborales en calculos de atraso/adelanto.

## Timeline

El timeline se renombro como:

```text
Panel de Control de Despacho
```

Muestra dias cercanos a hoy, con lectura mas amplia y menos dias visibles para que los textos no queden apretados.

Debe mostrar tareas del dia actual y permitir navegar en el tiempo.

## Tabla de Tareas

La tabla quedo agrupada por proyecto, con:

- Nombre de proyecto.
- Resumen bajo el proyecto.
- Estado visual por color.
- Tareas expandibles.
- Seleccion del proyecto completo.
- Edicion individual de tareas.
- Acciones mas compactas con iconos.

Se esta ajustando el uso del espacio: la idea acordada es reducir espacio vacio y usar panel lateral derecho para filtros, resumen de cumplimiento y foco por proyecto.

## Colores Operativos

Logica visual:

- Rojo: proyecto o tarea con atraso.
- Gris oscuro o sutil: proximos despachos / pendiente operativo.
- Tonos mas suaves con transparencia para estados no criticos.
- El rojo debe permanecer mas visible que los demas.

El foco por proyecto debe coincidir con los colores usados en la tabla.

## Reportes

Se creo una seccion de reportes en:

```text
/diario
```

Dentro de reportes se navega entre:

- Reporte diario.
- Resumen de entregas.

La idea es que ambas paginas esten dentro de Reportes, y los botones globales de imprimir/descargar/enviar por mail actuen segun la hoja activa.

## Reporte Diario

El reporte diario incluye:

- Resumen general.
- Estadisticas por proyecto.
- Tareas con atraso por proyecto.
- Subdespliegue por proyecto.
- Tareas programadas del dia.
- Observaciones.
- Estado.
- Fecha programada.
- Cumplimiento.

Se pidio clarificar indicadores:

- Avance del dia: tareas programadas para hoy que fueron completadas.
- Avance acumulado: cumplimiento total del proyecto considerando todas sus tareas internas.

## Resumen de Entregas

El antiguo reporte imprimible se esta integrando como segunda hoja dentro de Reportes:

```text
Resumen de entregas
```

Debe tener boton global para:

- imprimir/descargar
- enviar por correo

Se pidio eliminar botones duplicados internos de imprimir y usar los botones globales superiores.

## PDF y Correo

Se implemento generacion/envio de reportes por correo.

Asunto requerido para reporte diario:

```text
REPORTE DE ENTREGAS [fecha de envio]
```

Cuerpo requerido:

```text
Estimado(s),
Se envia reporte de entregas correspondientes al dia de [fecha de hoy].
```

Debe incluir firma del Departamento de Planificacion, sin nombre personal.

Se pidio que el PDF:

- Sea similar a lo visible en pantalla.
- Use fechas en formato `dia-mes-año`, no `año-mes-dia`.
- Tenga encabezados negros en app.
- En PDF use encabezados legibles, con fondo blanco y borde naranjo delgado para ahorrar tinta.
- Evite textos cortados o superpuestos.
- Sea formal y apto para clientes/jefaturas.

Historial de envios:

- Fecha y hora.
- Usuario que envio.
- Destinatarios.
- Proyecto(s) incluidos.
- Archivo generado.
- Estado de envio.
- Reenvio futuro.

## Barra Lateral

Se agrego barra lateral blanca con borde naranjo delgado e iconos naranjos.

Comportamiento deseado:

- Colapsada muestra iconos.
- Al pasar el mouse o expandir, muestra nombres.
- Permite navegar entre tablero, reportes, usuarios/administracion y bitacora.

Se ajusto para que no consuma tanto espacio horizontal. Arriba debe ir el cuadrado/isotipo rojo y al lado el logo, no solo texto.

## Administracion y Auditoria

Se pidieron y comenzaron bases para:

- Usuarios activos online.
- Ultima actividad.
- Bitacora de cambios.
- Filtros por usuario, fecha y accion.

Tablas relacionadas:

- `UserPresence`
- `AuditLog`

## Pendientes Importantes

1. Abrir el proyecto nuevo de Codex linkeado a:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto
```

2. Revisar estado Git:

```powershell
git status
```

3. Compilar:

```powershell
npm.cmd run build
```

4. Verificar visualmente:

```text
http://localhost:3000
http://localhost:3000/diario
```

5. Confirmar que Reportes tenga:

- Reporte diario.
- Resumen de entregas.
- Botones globales para imprimir/descargar/enviar.

6. Revisar PDF:

- fechas dia-mes-año
- encabezados visibles
- layout similar a pantalla
- sin textos cortados

7. Revisar la carpeta residual:

```text
C:\Users\Enrique Arenas\Documents\New project
```

Esta carpeta quedo obsoleta. Estaba casi vacia, pero Windows no permitio renombrarla porque algun proceso la tenia tomada. Cuando el nuevo proyecto de Codex este funcionando, se puede cerrar Codex y eliminar/renombrar esa carpeta residual.

8. Hacer commit y push a GitHub cuando el estado este estable.

## Comandos Utiles

Levantar app:

```powershell
npm.cmd run dev
```

Verificar base:

```powershell
npx.cmd supabase status
```

Levantar Supabase:

```powershell
npx.cmd supabase start
```

Detener Supabase:

```powershell
npx.cmd supabase stop
```

Migraciones:

```powershell
npm.cmd run prisma:migrate
```

Build:

```powershell
npm.cmd run build
```

## Nota Para Continuar En Nuevo Chat

Mensaje recomendado para pegar en el nuevo chat:

```text
Continuemos el proyecto Control de Entregas - Formatto.

La app esta en:
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto

Primero revisa:
- RESUMEN_TRABAJO_FORMATTO.md
- CONTEXTO.md
- git status
- npm run build

Mantener estilo Formatto, no romper la app actual, y seguir con los ajustes de reportes/dashboard.
```
