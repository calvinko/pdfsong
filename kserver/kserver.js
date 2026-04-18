import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { createAuthRouter, requireAuth } from './auth.js';
import songPdfRouter from './songpdf.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGINS = new Set([
  'https://pdfsong.vercel.app',
  'https://mysong.kosolution.net',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}


app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: false
  })
);
app.use(express.json());
app.use(
  '/auth',
  createAuthRouter({ pool })
);
app.use('/songpdf', songPdfRouter);

app.post('/savelibrary', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.auth?.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    const input = req.body?.songbook_json;

    if (input === undefined) {
      return res.status(400).json({ error: 'Provide songbook_json in the request body.' });
    }

    let normalizedJson;

    if (typeof input === 'string') {
      JSON.parse(input);
      normalizedJson = input;
    } else {
      normalizedJson = JSON.stringify(input);
    }

    await pool.execute(
      `
      INSERT INTO user_songbook_libraries (user_id, songbooks_json)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        songbooks_json = CAST(? AS JSON),
        updated_at = CURRENT_TIMESTAMP
      `,
      [userId, normalizedJson, normalizedJson]
    );

    res.json({
      ok: true,
      route: '/savelibrary',
      userId
    });
  } catch (error) {
    console.error('Save library failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to save library.'
    });
  }
});

app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: rows[0].ok === 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
