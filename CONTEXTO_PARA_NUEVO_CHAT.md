# Contexto para nuevo chat - Control de Entregas Formatto

Fecha: 2026-05-06  
Proyecto: Control de Entregas - Formatto

## Ruta del proyecto

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto
```

App local:

```text
http://localhost:3000
```

Deploy:

```text
https://formatto-control-entregas.vercel.app
```

## Estado general

La aplicacion es una app Next.js 14 con React, TypeScript, Prisma y Supabase Cloud.

El proyecto antes usaba Supabase local con Docker, pero la direccion actual es trabajar con Supabase Cloud para que local y Vercel apunten a la misma base de datos.

Supabase Cloud esta dentro del proyecto:

```text
formatto-erp
```

La idea estrategica es mantener Control de Entregas como modulo separado dentro del ecosistema Formatto ERP, sin borrar ni interferir con tablas existentes del ERP.

## Puntos importantes

- No borrar tablas existentes de `formatto-erp`.
- Antes de limpiezas masivas, respaldar datos.
- Docker ya no deberia ser requisito operativo principal.
- Localhost y Vercel deben usar el mismo `DATABASE_URL` de Supabase Cloud.
- No exponer claves ni strings de conexion en respuestas.

## Stack

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Supabase Cloud
- Vercel
- PDFKit para reportes PDF
- `xlsx` para importador Excel

## Comandos utiles

Entrar al proyecto:

```powershell
cd "C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto"
```

Revisar estado:

```powershell
git status
```

Compilar:

```powershell
npm run build
```

Si falla por bloqueo de Prisma/Node:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; npm.cmd run build
```

Levantar local:

```powershell
npm run dev
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "database": "up"
}
```

## Modulos principales

La app tiene:

- Dashboard principal.
- Panel de Control de Despacho.
- Panel de Entregas Urgentes.
- Panel de Control de Tareas.
- Pagina de tareas.
- Pagina de urgencias.
- Pagina de despacho.
- Pagina de usuarios.
- Pagina de bitacora.
- Pagina de reportes.
- Importador Excel.
- Reportes PDF.
- Bitacora e historial de cambios.

## Roles y usuarios

Roles:

- `admin`: administra usuarios, tareas, estados y reportes.
- `operador`: opera tareas y estados.
- `lector`: visualiza informacion.

Hay gestion de usuarios desde la app.

## Modelo funcional actual

Lineas de negocio:

- Constructora.
- Particulares.
- Retail.
- Convenio Marco.

Tipo de proyecto:

- Edificio.
- Casas.
- Mixto.
- No aplica.

Regla importante:

- Para Constructora, el tipo de proyecto puede ser `Edificio`, `Casas` o `Mixto`.
- Para Particulares, Retail y Convenio Marco, el tipo de proyecto debe quedar como `No aplica`.

Campos operativos relevantes:

- Linea de negocio.
- Proyecto.
- Tipo proyecto.
- Tipo.
- Descripcion.
- Torre.
- Nucleo.
- Piso.
- Deptos/Casas.
- Fabricacion.
- Cantidad.
- Fecha despacho.
- Fecha ingreso produccion.
- Estado produccion.
- Estado despacho.
- Fecha real despacho.
- Observacion.
- Notas despacho.

## Estados de despacho

Estados actuales:

- Pendiente.
- Parcial.
- Despachado.
- Cambio.
- Urgente.

Logica:

- Una entrega parcial no cuenta como despachada.
- Si queda parcial, debe generar o mantener tarea pendiente/urgente para completar saldo.
- El historial debe registrar usuario, cambio anterior, cambio nuevo y fecha.

## Estados de produccion

Estados productivos:

- Plan.
- Corte.
- Enchape.
- Perforado.
- Consolidado.
- Embalaje.
- Armado.
- CD.

Rutas:

- RTA / Embalaje: `Plan -> Corte -> Enchape -> Perforado -> Consolidado -> Embalaje -> CD`
- Armado: `Plan -> Corte -> Enchape -> Perforado -> Consolidado -> Armado -> CD`

Regla:

- Si una tarea se marca como despachada, la app debe preguntar si los estados productivos se hicieron para dejarlos en `CD`.

## Cambios recientes aplicados

### Produccion

- Se agrego estado `Plan`.
- Se usa `Plan`, no `Planificado`.
- El importador acepta `Planificado` como alias, pero guarda `Plan`.
- Se agrego fecha de ingreso a produccion.
- Produccion se muestra como avance visual.
- Produccion puede cambiarse desde modal y directo en panel.
- Si hay tareas seleccionadas, un cambio productivo aplica a todas las seleccionadas.

### Tabla de tareas

- Informacion principal queda a la izquierda.
- Produccion queda a la derecha.
- Separador naranja para zona de ubicacion/cantidad.
- Separador gris claro para produccion.
- Checkboxes mas chicos.
- La seleccion sirve para aplicar cambios a varias tareas.
- Se elimino la necesidad del control masivo superior anterior.

### Ubicacion y cantidades

- Constructora usa Torre, Nucleo, Piso y Deptos/Casas.
- Si el proyecto es tipo Casas, la columna visual de Piso muestra Casas.
- Particulares, Retail y Convenio Marco no usan Edificio/Casas.
- Para Particulares/Retail/Convenio, la cantidad de muebles se muestra como numero principal.
- Se elimino la palabra "mueble" en la cantidad porque ensuciaba la lectura.

### Escritura y estandarizacion

- Linea de negocio en mayusculas.
- Resto con primera letra mayuscula y resto minusculas.
- Se limpio descripcion de Constructora para evitar repetir proyecto/conjunto.
- Se corrigio duplicacion visual de torre/proyecto en algunas cargas.

### Filtros

- Los filtros superiores afectan:
  - Panel de Control de Despacho.
  - Panel de Entregas Urgentes.
  - Panel de Control de Tareas.
  - Foco por proyecto.
- Los filtros son dependientes:
  - Si se elige linea de negocio, los demas filtros deben mostrar solo opciones relacionadas.

### Timeline

- El Panel de Control de Despacho tiene timeline navegable.
- Se pidio que el deslizador sea fluido:
  - Al moverlo, el timeline avanza.
  - Al soltarlo, la pagina queda centrada en el timeline.

## Importador Excel

Se corrigio error:

```text
Loading chunk _app-pages-browser_node_modules_xlsx_xlsx_mjs failed
```

Solucion aplicada:

- `xlsx` se importa de forma estatica.
- El importador tiene indicador/modal de carga.

Reglas del importador:

- Lee correctamente `Tipo`, sin confundirlo con `Tipo Proyecto`.
- Lee `Estado Despacho`.
- Lee `Fecha Real Despacho`.
- Lee `Notas Despacho`.
- Lee estados productivos.
- Convierte fechas Excel.
- Fuerza `No aplica` para tipo de proyecto en lineas no Constructoras.

Ultimo archivo Excel generado:

```text
C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto\docs\carga-ajuste-realidad-entregas-202605051851.xlsx
```

Ese archivo tenia 81 filas y se uso para reparar datos despues de una carga donde se perdio el campo `tipo`.

Distribucion reparada:

- ADICIONAL: 3
- CLOSET: 30
- COCINA: 27
- MUEBLE: 18
- PIERNAS: 1
- PUERTAS CLOSET: 1
- VANITORIO: 1

Tipo proyecto reparado:

- Constructora Casas: 9
- Constructora Edificio: 54
- Particulares No aplica: 14
- Retail No aplica: 4

## Reportes PDF

Reportes existentes:

- Reporte de Entrega Diaria.
- Reporte de Entrega General.
- Reporte de Bitacora.

Se ajustaron:

- Titulos generales.
- Subtitulos.
- Lineas mas finas.
- Textos dentro de contenedores.
- Detalle completo en bitacora.
- Reporte general similar a lo que se ve en la app.

Titulos estandarizados:

- `REPORTE DE ENTREGA DIARIA`
- `REPORTE DE ENTREGA GENERAL`

Subtitulo esperado:

```text
Control de Entregas - Formatto - [fecha larga]
```

## Envio de mail desde reportes

Estado actual:

- En localhost el envio usa Outlook de escritorio via PowerShell/COM.
- En Vercel el envio de correo queda deshabilitado por ahora.
- Resend se intento configurar, pero queda al lado porque sin verificar dominio solo permite enviar a la cuenta de prueba.

Se centralizo el envio en:

```text
lib/outlook-mail.ts
```

Rutas que lo usan:

```text
app/api/daily-report/send/route.ts
app/api/summary-report/send/route.ts
app/api/daily-report/history/[id]/resend/route.ts
```

Mejora aplicada:

- Ahora los errores de Outlook se muestran mas claros.
- Localmente intenta Outlook.
- En Vercel muestra mensaje claro indicando que el envio esta pendiente.
- Se dejo copia automatica de claves a `enrique.arenas@formatto.cl`.
- Se agrego historial privado cifrado de claves para admin.

Pendiente recomendado:

- Verificar DNS de `formatto.cl` en Resend para poder enviar desde `enrique.arenas@formatto.cl`, o implementar Microsoft Graph.
- Cuando el dominio este verificado y se retome Resend, cambiar `FORMATTO_MAIL_FROM` en Vercel a:

```text
Enrique Arenas D. <enrique.arenas@formatto.cl>
```
- A futuro, evaluar Microsoft Graph si se requiere enviar estrictamente desde el buzon corporativo real.

## Archivos relevantes

Dashboard principal:

```text
app/page.tsx
```

Tipos cliente:

```text
lib/client-types.ts
```

Validaciones:

```text
lib/validators.ts
```

Prisma:

```text
prisma/schema.prisma
```

Reportes:

```text
lib/daily-report.ts
lib/summary-report.ts
app/diario/page.tsx
app/api/daily-report/send/route.ts
app/api/summary-report/send/route.ts
```

Mail Outlook:

```text
lib/outlook-mail.ts
```

Importador/exportador Excel:

```text
app/page.tsx
scripts/export-current-dispatches-xlsx.mjs
```

Bitacora:

```text
app/bitacora/page.tsx
app/api/audit/route.ts
app/api/audit/pdf/route.ts
```

## Validacion reciente

Ultima validacion realizada:

```powershell
npm run build
```

Resultado:

```text
Compiled successfully
```

Health local:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Resultado:

```json
{
  "ok": true,
  "database": "up"
}
```

## Pendientes recomendados

1. Probar envio de mail local con Outlook abierto.
2. Definir envio definitivo para Vercel:
   - SMTP.
   - Microsoft Graph.
   - Resend.
3. Revisar Vercel y variables de entorno.
4. Probar importador con plan de mayo completo.
5. Validar filtros dependientes en dashboard, despacho, urgencias y tareas.
6. Revisar performance al marcar estados productivos.
7. Hacer respaldo antes de cualquier limpieza masiva.
8. Crear commit ordenado con cambios recientes.
9. Documentar schema/tablas usadas en Supabase Cloud para integracion futura con Formatto ERP.

## Instruccion para el proximo chat

Antes de trabajar, revisar:

```text
CONTEXTO.md
RESUMEN_TRABAJO_FORMATTO.md
CONTEXTO_PARA_NUEVO_CHAT.md
git status
npm run build
```

Luego continuar desde el estado actual, sin asumir que Docker sigue siendo requisito principal.
