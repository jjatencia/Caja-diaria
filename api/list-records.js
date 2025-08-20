import { google } from 'googleapis';

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
      valueRenderOption: 'UNFORMATTED_VALUE',
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
        apertura: Number(row[4] || 0),
        ingresos: Number(row[5] || 0),
        tarjetaExora: Number(row[6] || 0),
        tarjetaDatafono: Number(row[7] || 0),
        difTarjeta: Number(row[8] || 0),
        entradas: Number(row[9] || 0),
        salidas: Number(row[10] || 0),
        total: Number(row[11] || 0),
        cierre: Number(row[12] || 0),
        dif: Number(row[13] || 0),
      });
    }

    res.status(200).json({ ok: true, records });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo obtener', detalle: String(err) });
  }
}
