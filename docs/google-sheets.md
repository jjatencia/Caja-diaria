# Integración con Google Sheets

Este módulo permite sincronizar los cierres de caja con la hoja de cálculo de Google Sheets.

Los registros nuevos se insertan en la primera fila disponible de cada hoja,
desplazando hacia abajo los datos existentes tanto en **LBJ** como en
**Tesorería**.

## Configuración

1. **Credenciales**: guardar el JSON de la cuenta de servicio en un archivo local y establecer la variable de entorno `GSHEET_CREDENTIALS` con la ruta al archivo.
2. **Hoja de cálculo**: si se desea usar otro libro u hoja, definir `GSHEET_ID` y `GSHEET_NAME` en las variables de entorno.
3. **Tesorería**: para registrar movimientos de tesorería en una hoja separada, establecer `GSHEET_TREASURY_NAME` con el nombre de dicha hoja.

## Uso

```js
import { appendRecord, updateRecord, deleteRecord } from './api/googleSheets.js';

// Crear
const id = await appendRecord({ fecha: '01/01/2024', hora: '18:00', sucursal: 'Parets del Vallès' });

// Actualizar
await updateRecord(id, { cierre: 100.5, total: 200 });

// Eliminar
await deleteRecord(id);
```

Todas las funciones generan logs y lanzan errores si la operación no se completa correctamente.
