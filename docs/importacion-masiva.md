# Importacion Masiva de Entregas

La carga masiva se realiza desde el tablero principal con el boton de importar Excel. La app lee la primera hoja del archivo.

## Columnas Recomendadas

```text
Proyecto
Linea Negocio
Fecha Despacho
Tipo
Descripcion
Torre
Nucleo
Piso
Deptos/Casas
Observacion
```

## Reglas

- `Proyecto` es obligatorio.
- `Linea Negocio` es opcional. Valores recomendados: `Constructora`, `Particulares`, `Retail`, `Convenio Marco`. Si viene vacio, la app usa `Constructora`.
- `Fecha Despacho` es obligatoria.
- `Tipo` es opcional. Si viene vacio, la app usa `COCINA`.
- `Descripcion` es opcional y sirve especialmente para Particulares, Retail y Convenio Marco.
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
Periodo,Linea Negocio,Proyecto,Fecha Despacho,Tipo,Descripcion,Torre,Nucleo,Piso,Deptos/Casas,Observacion
2026-05,Constructora,VIVE QUINTA,2026-05-08,COCINA,Cocinas deptos piso 4,Torre A,Nucleo 1,Piso 4,10,Prioridad cliente
2026-05,Particulares,Cliente particular ejemplo,2026-05-10,ADICIONAL,Mueble especial segun orden,,,,1,No aplica torre/nucleo/piso
2026-05,Retail,Retail ejemplo,2026-05-12,POST VENTA,Producto retail ejemplo,,,,5,
2026-05,Convenio Marco,Convenio marco ejemplo,2026-05-15,QUINCALLERIA,Entrega por convenio,,,,3,
```

La plantilla base esta en:

```text
docs/plantilla-importacion-entregas.csv
```
