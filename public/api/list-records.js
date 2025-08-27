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
    const sheetName = process.env.GSHEET_NAME || 'LBJ';

    const desde = req.query.desde || '0000-01-01';
    const hasta = req.query.hasta || '9999-12-31';
    const sucursal = req.query.sucursal
      ? String(req.query.sucursal).trim().toLowerCase()
      : '';
    const id = req.query.id ? String(req.query.id).trim() : '';

    const range = `${sheetName}!A:N`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = response.data.values || [];

    const records = [];
    for (const row of rows) {
      if (!row.length || row[0] === 'ID') continue;
      if (id && String(row[0]) !== id) continue;
      const rawDate = row[1];
      if (!rawDate) continue;
      let fecha;
      if (typeof rawDate === 'number') {
        const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        fecha = date.toISOString().split('T')[0];
      } else {
        fecha = rawDate;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
          const [d, m, y] = rawDate.split('/');
          fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      if (fecha < desde || fecha > hasta) continue;

      const rowSucursal = row[3] ? String(row[3]).trim().toLowerCase() : '';
      if (sucursal && rowSucursal !== sucursal) continue;

      let hora = '';
      const rawTime = row[2];
      if (rawTime || rawTime === 0) {
        if (typeof rawTime === 'number') {
          const ms = Math.round(rawTime * 86400 * 1000);
          const d = new Date(ms);
          const h = d.getUTCHours().toString().padStart(2, '0');
          const m = d.getUTCMinutes().toString().padStart(2, '0');
          hora = `${h}:${m}`;
        } else if (typeof rawTime === 'string') {
          const cleaned = rawTime.replace(/\s+/g, '').replace('/', ':');
          const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
          if (match) {
            const [_, h, m] = match;
            hora = `${h.padStart(2, '0')}:${m}`;
          } else {
            hora = cleaned;
          }
        }
      }

      records.push({
        id: row[0],
        fecha,
        hora,
        sucursal: row[3] || '',
        apertura: parseNum(row[4] || 0),
        ingresos: parseNum(row[5] || 0),
        tarjetaExora: parseNum(row[6] || 0),
        tarjetaDatafono: parseNum(row[7] || 0),
        difTarjeta: parseNum(row[8] || 0),
        entradas: parseNum(row[9] || 0),
        salidas: parseNum(row[10] || 0),
        total: parseNum(row[11] || 0),
        cierre: parseNum(row[12] || 0),
        dif: parseNum(row[13] || 0),
      });
    }

    res.status(200).json({ ok: true, records });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo obtener', detalle: String(err) });
  }
}
