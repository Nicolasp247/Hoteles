# Módulo de Exportaciones Excel
Este módulo se encarga de generar archivos Excel (.xlsx) a partir de datos del sistema (principalmente cotizaciones).

Arquitectura separada por responsabilidades para permitir escalabilidad y mantenimiento limpio.

------------------------------------------------------------

Estructura:

excel/
│
├── controllers/
│   Manejan las rutas HTTP.
│   - Reciben request.
│   - Validan parámetros.
│   - Llaman al service.
│   - Envían el archivo usando sendExcel.
│
│   Ejemplo:
│   GET /api/exports/cotizaciones/:id.xlsx
│
├── services/
│   Orquestan la lógica.
│   - Obtienen datos desde la base de datos.
│   - Construyen el payload estándar:
│       { cabecera, items }
│   - Llaman al builder.
│
├── builders/
│   Construyen el workbook.
│   - Crean el workbook ExcelJS.
│   - Agregan hoja "A".
│   - Llaman a los renderers.
│   - Devuelven buffer listo para descarga.
│
├── templates/
│   Definen el layout visual (estructura).
│   - Posiciones de columnas.
│   - Merges.
│   - Estructura general.
│
├── renderers/
│   Pintan secciones específicas.
│   - header.renderer.js → cabecera
│   - table.renderer.js → tabla de servicios
│   - totals.renderer.js → totales
│
├── utils/
│   Funciones reutilizables:
│   - sendExcel.js → envía el archivo
│   - filename.js → sanitiza nombre archivo
│   - styles.js → estilos base Excel
│   - ranges.js → merges, bordes, helpers
│
└── tests/
    Archivos mock para pruebas sin BD.

------------------------------------------------------------

Convenciones:

- Todas las exportaciones tienen UNA hoja llamada "A".
- El nombre del archivo es el nombre automático generado en cotización.
- El builder nunca accede directamente a la BD.
- Los services nunca contienen lógica de estilos.
- Los controllers nunca contienen lógica de Excel.

------------------------------------------------------------

Flujo:

Controller → Service → Builder → Renderers → sendExcel