// api/update-record.js
import { updateRecord } from './googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Solo POST' });
    return;
  }

  const id = req.body?.id;
  if (!id) {
    res.status(400).json({ error: 'Falta id' });
    return;
  }

  try {
    await updateRecord(id, req.body || {});
    res.status(200).json({ ok: true, id, mensaje: `Registro ${id} actualizado` });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'No se pudo actualizar', detalle: String(err) });
  }
}
