// api/delete-record.js  (ESM)
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

    // 1) ID obligatorio
    const id = req.body?.id;
    if (!id) { res.status(400).json({ error: 'Falta id' }); return; }

    // 2) Buscar la fila por ID (columna A)
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      majorDimension: 'ROWS'
    });
    const rows = colA.data.values || [];
    let rowNumber = -1;
    for (let i = 1; i < rows.length; i++) { // i=1 salta cabecera
      if (rows[i] && rows[i][0] === id) { rowNumber = i + 1; break; } // Sheets es 1-based
    }
    if (rowNumber === -1) { res.status(404).json({ error: 'ID no encontrado' }); return; }

    // 3) Obtener sheetId numérico (gid) para poder borrar la fila real
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tab = meta.data.sheets.find(s => s.properties.title === sheetName);
    if (!tab) { res.status(404).json({ error: `Hoja ${sheetName} no encontrada` }); return; }
    const sheetId = tab.properties.sheetId;

    // 4) Borrar la fila (deleteDimension usa índices 0-based y endIndex exclusivo)
    const startIndex = rowNumber - 1; // convertir a 0-based
    const endIndex = rowNumber;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex
            }
          }
        }]
      }
    });

    res.status(200).json({ ok: true, id, mensaje: `Registro ${id} borrado (fila ${rowNumber})` });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'No se pudo borrar', detalle: String(err) });
  }
}
