import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 建立資料表
await pool.query(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS entries (
    client_id TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (client_id)
  );
`);

// ===== CLIENTS =====
app.get('/api/clients', async (req, res) => {
  const result = await pool.query('SELECT data FROM clients ORDER BY updated_at DESC');
  res.json(result.rows.map(r => r.data));
});

app.post('/api/clients', async (req, res) => {
  const clients = req.body;
  await pool.query('DELETE FROM clients');
  for (const client of clients) {
    await pool.query(
      'INSERT INTO clients (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data=$2, updated_at=NOW()',
      [client.id, client]
    );
  }
  res.json({ ok: true });
});

// ===== ENTRIES =====
app.get('/api/entries/:clientId', async (req, res) => {
  const result = await pool.query('SELECT data FROM entries WHERE client_id=$1', [req.params.clientId]);
  res.json(result.rows[0]?.data || {});
});

app.post('/api/entries/:clientId', async (req, res) => {
  await pool.query(
    'INSERT INTO entries (client_id, data) VALUES ($1, $2) ON CONFLICT (client_id) DO UPDATE SET data=$2, updated_at=NOW()',
    [req.params.clientId, req.body]
  );
  res.json({ ok: true });
});

app.delete('/api/entries/:clientId', async (req, res) => {
  await pool.query('DELETE FROM entries WHERE client_id=$1', [req.params.clientId]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
