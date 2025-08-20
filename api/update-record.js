// api/update-record.js  (ESM)
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Solo POST' }); return; }

  try {
    const raw = process.env.GSHEET_CREDENTIALS;
    if (!raw) { res.status(500).json({ error: 'Falta GSHEET_CREDENTIALS' }); return; }
    const creds = JSON.parse(raw);

    const auth = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.GSHEET_ID;
    const sheetName = process.env.GSHEET_NAME || 'LBJ';

    // 1) Necesitamos al menos el ID
    const id = req.body?.id;
    if (!id) { res.status(400).json({ error: 'Falta id' }); return; }

    // 2) Buscar la fila por ID (columna A)
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      majorDimension: 'ROWS'
    });
    const rows = colA.data.values || [];
    // encontrar el índice: fila 1 es cabecera → datos comienzan en índice 1
    let rowNumber = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === id) { rowNumber = i + 1; break; } // +1 porque Sheets es 1-based
    }
    if (rowNumber === -1) { res.status(404).json({ error: 'ID no encontrado' }); return; }

    // 3) Preparar los valores en el mismo orden de columnas:
    // A:ID | B:Fecha | C:Hora | D:Sucursal | E:Apertura | F:Ingresos | G:Tarjeta Exora | H:Tarjeta Datafono |
    // I:Dif | J:Entradas | K:Salidas | L:Total | M:Cierre | N:Dif
    const values = [[
      id,
      req.body.fecha ?? '',
      req.body.hora ?? '',
      req.body.sucursal ?? '',
      req.body.apertura ?? '',
      req.body.ingresos ?? '',
      req.body.tarjetaExora ?? '',
      req.body.tarjetaDatafono ?? '',
      req.body.dif ?? '',
      req.body.entradas ?? '',
      req.body.salidas ?? '',
      req.body.total ?? '',
      req.body.cierre ?? '',
      req.body.dif ?? ''
    ]];

    // 4) Actualizar exactamente esa fila (A..N)
    const range = `${sheetName}!A${rowNumber}:N${rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    res.status(200).json({ ok: true, id, mensaje: `Registro ${id} actualizado en fila ${rowNumber}` });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'No se pudo actualizar', detalle: String(err) });
  }
}
