# Importacion Masiva de Entregas

La carga masiva se realiza desde el tablero principal con el boton de importar Excel. La app lee la primera hoja del archivo.

## Columnas Recomendadas

```text
Proyecto
Fecha Despacho
Tipo
Torre
Nucleo
Piso
Deptos/Casas
Observacion
```

## Reglas

- `Proyecto` es obligatorio.
- `Fecha Despacho` es obligatoria.
- `Tipo` es opcional. Si viene vacio, la app usa `COCINA`.
- `Torre`, `Nucleo`, `Piso` y `Observacion` son opcionales. Si vienen vacios, se entiende que no aplica.
- `Deptos/Casas` es opcional y representa la cantidad de unidades. Si viene vacio, se guarda como `0`.
- Las tareas importadas entran como estado `pendiente`.
- La importacion agrega tareas al tablero activo.

## Formato de Fecha

Usar preferentemente:

```text
AAAA-MM-DD
```

Ejemplo:

```text
2026-05-08
```

## Ejemplo

```csv
Proyecto,Fecha Despacho,Tipo,Torre,Nucleo,Piso,Deptos/Casas,Observacion
VIVE QUINTA,2026-05-08,COCINA,Torre A,Nucleo 1,Piso 4,10,Prioridad cliente
VIVE QUINTA,2026-05-10,CLOSET,Torre A,,Piso 5,8,
EDIFICIO DEMO,2026-05-12,PUERTAS ABATIR,,,Casa 12,1,No aplica torre/nucleo
```

La plantilla base esta en:

```text
docs/plantilla-importacion-entregas.csv
```
