// api/append-record.js
import { google } from 'googleapis';

function uuid() {
  // UUID v4 simple (suficiente para hoja de cálculo)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Solo se permite POST' }); return;
  }

  try {
    const raw = process.env.GSHEET_CREDENTIALS;
    if (!raw) { res.status(500).json({ error: 'Falta GSHEET_CREDENTIALS' }); return; }
    const creds = JSON.parse(raw);

    const auth = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.GSHEET_ID;                 // <- tu env correcta
    const sheetName = process.env.GSHEET_NAME || 'Cierres';
    const range = `${sheetName}!A1`;

    // Genera ID si no viene
    const id = req.body.id || uuid();

    // Orden de columnas en tu hoja:
    // ID | Fecha | Hora | Sucursal | Apertura | Ingresos | Tarjeta Exora | Tarjeta Datafono | Dif | Entradas | Salidas | Total | Cierre | Dif
    const values = [[
      id,
      req.body.fecha,
      req.body.hora,
      req.body.sucursal,
      req.body.apertura,
      req.body.ingresos,
      req.body.tarjetaExora,
      req.body.tarjetaDatafono,
      req.body.dif,
      req.body.entradas,
      req.body.salidas,
      req.body.total,
      req.body.cierre,
      req.body.dif
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });

    res.status(200).json({ ok: true, id, mensaje: `Cierre guardado en hoja ${sheetName}` });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo guardar', detalle: String(err) });
  }
}
