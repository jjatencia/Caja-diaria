import { google } from 'googleapis';
import fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.GSHEET_ID || '1lkROQ9BNKdVW2tk1YsOhAt5KMpm_e4jsHqooWqajO7Q';
const SHEET_NAME = process.env.GSHEET_NAME || 'LBJ';
const TESORERIA_SHEET_NAME = process.env.GSHEET_TREASURY_NAME || 'Tesorería';

let sheetsClient = null;
let sheetNumericId = null;
let tesoreriaSheetNumericId = null;

function loadCredentials() {
  const credentials = process.env.GSHEET_CREDENTIALS;
  if (!credentials) {
    throw new Error('GSHEET_CREDENTIALS env var missing');
  }
  
  // Si empieza con { es JSON directo, sino es ruta de archivo
  if (credentials.startsWith('{')) {
    return JSON.parse(credentials);
  } else {
    const raw = fs.readFileSync(credentials, 'utf8');
    return JSON.parse(raw);
  }
}

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title))',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
  const tesoreriaSheet = meta.data.sheets.find(
    s => s.properties.title === TESORERIA_SHEET_NAME
  );
  if (!sheet) {
    throw new Error(`Sheet ${SHEET_NAME} not found`);
  }
  if (!tesoreriaSheet) {
    throw new Error(`Sheet ${TESORERIA_SHEET_NAME} not found`);
  }
  sheetNumericId = sheet.properties.sheetId;
  tesoreriaSheetNumericId = tesoreriaSheet.properties.sheetId;
  return sheetsClient;
}

async function findRowById(id) {
  const client = await getSheetsClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === String(id)) {
      return i + 1; // 1-indexed row number
    }
  }
  return null;
}

async function getNextId() {
  const client = await getSheetsClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  const ids = rows
    .map(r => parseInt(r[0], 10))
    .filter(n => !isNaN(n));
  const max = ids.length ? Math.max(...ids) : 0;
  return max + 1;
}

function buildRow(id, data) {
  return [
    id,
    data.fecha || '',
    data.hora || '',
    data.sucursal || '',
    data.apertura || 0,
    data.ingresos || 0,
    data.tarjetaExora || 0,
    data.tarjetaDatafono || 0,
    data.difTarjeta || 0,
    data.entradas || 0,
    data.salidas || 0,
    data.total || 0,
    data.cierre || 0,
    data.dif || 0,
  ];
}

export async function appendRecord(data) {
  try {
    const client = await getSheetsClient();
    const id = await getNextId();
    const values = [buildRow(id, data)];
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: sheetNumericId,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 2,
              },
            },
          },
        ],
      },
    });
    await client.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:N2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    console.log(`Row inserted with ID ${id}`);
    return id;
  } catch (err) {
    console.error('Append failed', err);
    throw err;
  }
}

export async function updateRecord(id, data) {
  try {
    const client = await getSheetsClient();
    const row = await findRowById(id);
    if (!row) throw new Error(`ID ${id} not found`);
    const range = `${SHEET_NAME}!A${row}:N${row}`;
    const values = [buildRow(id, data)];
    await client.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [{ range, values }],
      },
    });
    console.log(`Row ${row} updated for ID ${id}`);
  } catch (err) {
    console.error('Update failed', err);
    throw err;
  }
}

export function buildTesoreriaRow(id, fecha, mov) {
  return [
    id,
    fecha || '',
    mov.tipo === 'entrada' ? 'Entrada' : 'Salida',
    mov.quien || '',
    mov.importe || 0,
  ];
}

export async function deleteTesoreriaMovimientos(cierreId) {
  const client = await getSheetsClient();

  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TESORERIA_SHEET_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  const rowsToDelete = [];
  rows.forEach((r, idx) => {
    if ((r[0] || '').startsWith(`${cierreId}-`)) {
      rowsToDelete.push(idx + 1);
    }
  });

  if (rowsToDelete.length) {
    const requests = rowsToDelete
      .sort((a, b) => b - a)
      .map(row => ({
        deleteDimension: {
          range: {
            sheetId: tesoreriaSheetNumericId,
            dimension: 'ROWS',
            startIndex: row - 1,
            endIndex: row,
          },
        },
      }));

    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
  }

  console.log(`Tesorería rows deleted for cierre ${cierreId}`);
}

export async function appendTesoreriaMovimientos(
  cierreId,
  fecha,
  movimientos = []
) {
  const client = await getSheetsClient();

  // Remover filas existentes para este cierre
  await deleteTesoreriaMovimientos(cierreId);

  if (movimientos.length) {
    const values = movimientos.map((mov, idx) =>
      buildTesoreriaRow(`${cierreId}-${idx + 1}`, fecha, mov)
    );
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: tesoreriaSheetNumericId,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 1 + values.length,
              },
            },
          },
        ],
      },
    });
    await client.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TESORERIA_SHEET_NAME}!A2:E${1 + values.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }

  console.log(`Tesorería rows synced for cierre ${cierreId}`);
}

export async function deleteRecord(id) {
  try {
    const client = await getSheetsClient();
    const row = await getRecordRow(id);
    if (!row) throw new Error(`ID ${id} not found`);
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetNumericId,
                dimension: 'ROWS',
                startIndex: row - 1,
                endIndex: row,
              },
            },
          },
        ],
      },
    });
    await deleteTesoreriaMovimientos(id);
    console.log(`Row ${row} deleted for ID ${id}`);
  } catch (err) {
    console.error('Delete failed', err);
    throw err;
  }
}

export async function getRecordRow(id) {
  return findRowById(id);
}

