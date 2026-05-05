# Importacion Masiva de Entregas

La carga masiva se realiza desde el tablero principal con el boton de importar Excel. La app lee la primera hoja del archivo.

## Columnas Recomendadas

```text
Proyecto
Tipo Proyecto
Linea Negocio
Fecha Despacho
Tipo
Descripcion
Torre
Nucleo
Piso
Fabricacion
Estado Produccion
Fecha Ingreso Produccion
Deptos/Casas
Observacion
```

## Reglas

- `Proyecto` es obligatorio.
- `Tipo Proyecto` es opcional. Valores: `Edificio`, `Casas`, `Mixto`, `No aplica`. Si viene vacio, Constructora usa `Edificio` y las otras lineas usan `No aplica`.
- `Linea Negocio` es opcional. Valores recomendados: `Constructora`, `Particulares`, `Retail`, `Convenio Marco`. Si viene vacio, la app usa `Constructora`.
- `Fecha Despacho` es obligatoria.
- `Tipo` es opcional. Si viene vacio, la app usa `COCINA`.
- `MUEBLE` se usa principalmente para Particulares, Retail y Convenio Marco.
- `ADICIONAL` queda disponible para todas las lineas, incluida Constructora.
- En Constructora, `MARCOS CLOSET` representa piernas/marcos asociados a closet.
- Tambien se aceptan `PUERTAS CLOSET`, `PIERNAS` y `VANITORIO` cuando vengan en programas de Constructora.
- `Descripcion` es opcional y sirve especialmente para Particulares, Retail y Convenio Marco.
- `Torre`, `Nucleo`, `Piso` y `Observacion` son opcionales. Si vienen vacios, se entiende que no aplica.
- `Fabricacion` es opcional. Valores: `RTA` o `ARMADO`. Si viene vacio, la app usa `RTA`.
- `Estado Produccion` es opcional. Valores: `Corte`, `Enchape`, `Perforado`, `Consolidado`, `Embalaje`, `Armado`, `CD`. Si viene vacio, la app usa `Corte`.
- `Fecha Ingreso Produccion` es opcional. Si viene vacio, queda sin fecha de ingreso a produccion.
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
Periodo,Linea Negocio,Proyecto,Tipo Proyecto,Fecha Despacho,Tipo,Descripcion,Torre,Nucleo,Piso,Fabricacion,Estado Produccion,Fecha Ingreso Produccion,Deptos/Casas,Observacion
2026-05,Constructora,VIVE QUINTA,Edificio,2026-05-08,COCINA,Cocinas deptos piso 4,Torre A,Nucleo 1,Piso 4,RTA,Corte,2026-05-02,10,Prioridad cliente
2026-05,Constructora,CHICAUMA,Casas,2026-05-08,COCINA,Cocinas casas,,,,RTA,Corte,2026-05-02,5,Casas 56 - 60
2026-05,Particulares,Cliente particular ejemplo,No aplica,2026-05-10,MUEBLE,Mueble especial segun orden,,,,ARMADO,Armado,2026-05-03,1,No aplica torre/nucleo/piso
2026-05,Retail,Retail ejemplo,No aplica,2026-05-12,MUEBLE,Producto retail ejemplo,,,,RTA,Embalaje,2026-05-04,5,
```

La plantilla base esta en:

```text
docs/plantilla-importacion-entregas.csv
```
