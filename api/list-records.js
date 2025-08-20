import { google } from 'googleapis';
import { parseNum } from '../utils/parseNum.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Solo se permite GET' });
    return;
  }

  try {
    const raw = process.env.GSHEET_CREDENTIALS;
    if (!raw) {
      res.status(500).json({ error: 'Falta GSHEET_CREDENTIALS' });
      return;
    }
    const creds = JSON.parse(raw);
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.GSHEET_ID;
    const sheetName = process.env.GSHEET_NAME || 'Cierres';

    const desde = req.query.desde || '0000-01-01';
    const hasta = req.query.hasta || '9999-12-31';
    const sucursal = req.query.sucursal;

    const range = `${sheetName}!A:N`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values || [];

    const records = [];
    for (const row of rows) {
      if (!row.length || row[0] === 'ID') continue;
      const rawDate = row[1];
      if (!rawDate) continue;
      let fecha = rawDate;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split('/');
        fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      if (fecha < desde || fecha > hasta) continue;
      if (sucursal && row[3] !== sucursal) continue;
      records.push({
        id: row[0],
        fecha,
        hora: row[2] || '',
        sucursal: row[3] || '',
        apertura: parseNum(row[4]),
        ingresos: parseNum(row[5]),
        tarjetaExora: parseNum(row[6]),
        tarjetaDatafono: parseNum(row[7]),
        difTarjeta: parseNum(row[8]),
        entradas: parseNum(row[9]),
        salidas: parseNum(row[10]),
        total: parseNum(row[11]),
        cierre: parseNum(row[12]),
        dif: parseNum(row[13]),
      });
    }

    res.status(200).json({ ok: true, records });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo obtener', detalle: String(err) });
  }
}
