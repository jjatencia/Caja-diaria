// api/append-record.js
import { appendRecord } from './googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Solo se permite POST' });
    return;
  }

  try {
    const id = await appendRecord(req.body || {});
    res.status(200).json({ ok: true, id, mensaje: 'Cierre guardado en hoja' });
  } catch (err) {
    console.error('Error Google Sheets:', err);
    res.status(500).json({ error: 'No se pudo guardar', detalle: String(err) });
  }
}
