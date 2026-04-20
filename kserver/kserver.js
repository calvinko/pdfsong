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

function getAuthenticatedUserId(req, res) {
  const userId = Number(req.auth?.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: 'Authenticated user is invalid.' });
    return null;
  }

  return userId;
}

function normalizeJsonColumn(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

app.post('/savelibrary', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

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

    const clientInstanceId = String(req.body?.instance_id || '').trim() || null;
    const deviceType = String(req.body?.device_type || '').trim() || null;

    await connection.beginTransaction();

    const [versionRows] = await connection.execute(
      `
      SELECT library_version
      FROM user_songbook_libraries
      WHERE user_id = ?
      ORDER BY library_version DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );
    const nextVersion = Number(versionRows[0]?.library_version || 0) + 1;

    const [result] = await connection.execute(
      `
      INSERT INTO user_songbook_libraries (user_id, library_version, client_instance_id, device_type, songbooks_json)
      VALUES (?, ?, ?, ?, ?)
      `,
      [userId, nextVersion, clientInstanceId, deviceType, normalizedJson]
    );

    await connection.commit();

    res.json({
      ok: true,
      route: '/savelibrary',
      id: result.insertId,
      userId,
      libraryVersion: nextVersion,
      clientInstanceId,
      deviceType
    });
  } catch (error) {
    await connection.rollback();
    console.error('Save library failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to save library.'
    });
  } finally {
    connection.release();
  }
});

async function getLibrary(req, res) {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

    const requestedVersion = req.query.version ? Number(req.query.version) : null;

    if (requestedVersion !== null && (!Number.isInteger(requestedVersion) || requestedVersion <= 0)) {
      return res.status(400).json({ error: 'version must be a positive integer.' });
    }

    const [rows] = await pool.execute(
      requestedVersion
        ? `
          SELECT id, library_version, client_instance_id, device_type, songbooks_json, created_at
          FROM user_songbook_libraries
          WHERE user_id = ? AND library_version = ?
          LIMIT 1
          `
        : `
          SELECT id, library_version, client_instance_id, device_type, songbooks_json, created_at
          FROM user_songbook_libraries
          WHERE user_id = ?
          ORDER BY library_version DESC, id DESC
          LIMIT 1
          `,
      requestedVersion ? [userId, requestedVersion] : [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: requestedVersion ? 'Library version not found.' : 'No saved library found.'
      });
    }

    const row = rows[0];

    res.json({
      ok: true,
      route: req.path,
      id: row.id,
      userId,
      libraryVersion: row.library_version,
      clientInstanceId: row.client_instance_id,
      deviceType: row.device_type,
      songbook_json: normalizeJsonColumn(row.songbooks_json),
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('Get library failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to get library.'
    });
  }
}

app.get('/getlibrary', requireAuth, getLibrary);
app.get('/getLibrary', requireAuth, getLibrary);

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
