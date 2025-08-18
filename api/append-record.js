// api/append-record.js  (versión ESM)
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Solo se permite POST' });
    return;
  }

  try {
    // Validación simple de campos
    const required = ['id','fecha','hora','sucursal','apertura','ingresos','tarjetaExora','tarjetaDatafono','dif','entradas','salidas','total','cierre'];
    const missing = required.filter(k => typeof (req.body || {})[k] === 'undefined');
    if (missing.length) {
      res.status(400).json({ error: 'Faltan campos', campos: missing });
      return;
    }

    // Credenciales desde env
    const raw = process.env.GSHEET_CREDENTIALS;
    if (!raw) {
      res.status(500).json({ error: 'Falta GSHEET_CREDENTIALS en Vercel' });
      return;
    }
    const creds = JSON.parse(raw);

    // Auth Google
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    // Datos hoja
   const spreadsheetId = process.env.GSHEET_ID;
    const sheetName = process.env.GSHEET_NAME || 'Cierres';
    const range = `${sheetName}!A1`;

    // Orden de columnas según tu cabecera:
    // ID | Fecha | Hora | Sucursal | Apertura | Ingresos | Tarjeta Exora | Tarjeta Datafono | Dif | Entradas | Salidas | Total | Cierre | Dif
    const values = [[
      req.body.id,
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
      req.body.dif // si esta última “Dif” es distinta, me dices el nombre y la separo
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });

    res.status(200).json({ ok: true, mensaje: `Cierre guardado en hoja ${sheetName}` });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo guardar', detalle: String(err) });
  }
}
