// api/delete-record.js
import { deleteRecord } from './googleSheets.js';

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
    await deleteRecord(id);
    res.status(200).json({ ok: true, id, mensaje: `Registro ${id} borrado` });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'No se pudo borrar', detalle: String(err) });
  }
}
