import { appendTesoreriaMovimientos } from './googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Solo se permite POST' });
    return;
  }

  try {
    const { cierreId, fecha, movimientos } = req.body || {};
    await appendTesoreriaMovimientos(cierreId, fecha, Array.isArray(movimientos) ? movimientos : []);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error Tesorería Sheets:', err);
    res.status(500).json({ error: 'No se pudieron guardar los movimientos', detalle: String(err) });
  }
}
