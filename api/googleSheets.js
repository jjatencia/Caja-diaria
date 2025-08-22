import { google } from 'googleapis';
import fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.GSHEET_ID || '1lkROQ9BNKdVW2tk1YsOhAt5KMpm_e4jsHqooWqajO7Q';
const SHEET_NAME = process.env.GSHEET_NAME || 'LBJ';
const TESORERIA_SHEET_NAME = process.env.GSHEET_TREASURY_NAME || 'Tesorería';

let sheetsClient = null;
let sheetNumericId = null;

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

async function getSheetsClient() {
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
  if (!sheet) {
    throw new Error(`Sheet ${SHEET_NAME} not found`);
  }
  sheetNumericId = sheet.properties.sheetId;
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
    await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    console.log(`Row appended with ID ${id}`);
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

function buildTesoreriaRow(id, fecha, mov) {
  return [
    id,
    fecha || '',
    mov.tipo === 'entrada' ? 'Entrada' : 'Salida',
    mov.importe || 0,
  ];
}

export async function appendTesoreriaMovimientos(cierreId, fecha, movimientos = []) {
  if (!movimientos.length) return;
  const client = await getSheetsClient();
  const values = movimientos.map((mov, idx) =>
    buildTesoreriaRow(`${cierreId}-${idx + 1}`, fecha, mov)
  );
  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TESORERIA_SHEET_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  console.log(`Tesorería rows appended for cierre ${cierreId}`);
}

export async function deleteRecord(id) {
  try {
    const client = await getSheetsClient();
    const row = await findRowById(id);
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
    console.log(`Row ${row} deleted for ID ${id}`);
  } catch (err) {
    console.error('Delete failed', err);
    throw err;
  }
}

export async function getRecordRow(id) {
  return findRowById(id);
}

