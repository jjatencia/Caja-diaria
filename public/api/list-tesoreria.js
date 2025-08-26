import { google } from 'googleapis';
import { parseNum } from '../utils/parseNum.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Solo se permite GET' });
    return;
  }

  const id = req.query.id ? String(req.query.id).trim() : '';
  if (!id) {
    res.status(400).json({ error: 'Falta id' });
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
    const sheetName = process.env.GSHEET_TREASURY_NAME || 'Tesorería';

    const range = `${sheetName}!A:E`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const rows = response.data.values || [];

    const movimientos = rows
      .filter(r => r[0] && String(r[0]).startsWith(`${id}-`))
      .map(r => ({
        tipo: (r[2] || '').toString().toLowerCase() === 'entrada' ? 'entrada' : 'salida',
        quien: r[3] || '',
        importe: parseNum(r[4] || 0)
      }));

    res.status(200).json({ ok: true, movimientos });
  } catch (err) {
    console.error('Error Tesorería Sheets:', err);
    res.status(500).json({ error: 'No se pudo obtener', detalle: String(err) });
  }
}
