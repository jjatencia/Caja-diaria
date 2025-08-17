import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }

  if (req.headers?.authorization !== process.env.API_KEY) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
    return;
  }

  let body;
  try {
    body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
    return;
  }

  const caja = body.caja_diaria || body.cajaDiaria || {};
  const movimientos = Array.isArray(body.movimientos) ? body.movimientos : [];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cajaKeys = Object.keys(caja);
    const cajaValues = cajaKeys.map((k) => caja[k]);
    const cajaCols = cajaKeys.map((k) => `"${k}"`).join(', ');
    const cajaParams = cajaKeys.map((_, i) => `$${i + 1}`).join(', ');
    const cajaQuery = `INSERT INTO caja_diaria (${cajaCols}) VALUES (${cajaParams}) RETURNING id`;
    const cajaResult = await client.query(cajaQuery, cajaValues);
    const cajaId = cajaResult.rows[0].id;

    for (const mov of movimientos) {
      const movKeys = Object.keys(mov);
      const movValues = movKeys.map((k) => mov[k]);
      const movCols = ['caja_diaria_id', ...movKeys.map((k) => `"${k}"`)].join(', ');
      const movParams = ['$1', ...movKeys.map((_, i) => `$${i + 2}`)].join(', ');
      await client.query(
        `INSERT INTO movimientos (${movCols}) VALUES (${movParams})`,
        [cajaId, ...movValues],
      );
    }

    await client.query('COMMIT');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    await client.query('ROLLBACK');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message }));
  } finally {
    client.release();
  }
}

