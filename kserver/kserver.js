import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import multer from 'multer';
import { pool } from './db.js';
import { createAuthRouter, requireAuth } from './auth.js';
import songPdfRouter from './songpdf.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const uploadsDir = 'uploads';
const songbooksChunkSize = Number(process.env.SONGBOOKS_DB_CHUNK_SIZE || 512 * 1024);

await fs.mkdir(uploadsDir, { recursive: true });

const songbooksUpload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) {
      cb(null, true);
      return;
    }

    cb(new Error('Upload a JSON backup file using the songbooks field.'));
  }
});
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
app.use(express.json({ limit: '250mb' }));
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

function serializeSongbooksRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    songbooksVersion: row.songbooks_version,
    exportedAt: row.exported_at,
    bookCount: row.book_count,
    sourceFileCount: row.source_file_count,
    byteSize: row.byte_size,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  };
}

async function getLatestSongbooksRow(userId) {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, songbooks_version, exported_at, book_count, source_file_count, byte_size, chunk_count, created_at
    FROM user_songbooks_data
    WHERE user_id = ?
    ORDER BY songbooks_version DESC, id DESC
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

app.post('/saveSongbooks', requireAuth, songbooksUpload.single('songbooks'), async (req, res) => {
  const connection = await pool.getConnection();
  const uploadedPath = req.file?.path || null;

  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

    if (!req.file) {
      return res.status(400).json({ error: 'Upload a JSON backup file using the songbooks form-data field.' });
    }

    const normalizedJson = await fs.readFile(req.file.path, 'utf8');
    const songbooks = JSON.parse(normalizedJson);

    if (
      songbooks?.type !== 'pdfsong-library-backup' ||
      !Array.isArray(songbooks.catalog) ||
      !songbooks.pdfs ||
      typeof songbooks.pdfs !== 'object'
    ) {
      return res.status(400).json({ error: 'songbooks_json must be a PDFSong backup JSON object.' });
    }

    const exportedAtDate = songbooks.exportedAt ? new Date(songbooks.exportedAt) : null;
    const exportedAt = exportedAtDate && !Number.isNaN(exportedAtDate.valueOf())
      ? exportedAtDate.toISOString().slice(0, 19).replace('T', ' ')
      : null;
    const bookCount = songbooks.catalog.length;
    const sourceFileCount = Object.keys(songbooks.pdfs).length;
    const chunks = [];

    for (let offset = 0; offset < normalizedJson.length; offset += songbooksChunkSize) {
      chunks.push(normalizedJson.slice(offset, offset + songbooksChunkSize));
    }

    await connection.beginTransaction();

    const [versionRows] = await connection.execute(
      `
      SELECT songbooks_version
      FROM user_songbooks_data
      WHERE user_id = ?
      ORDER BY songbooks_version DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );
    const nextVersion = Number(versionRows[0]?.songbooks_version || 0) + 1;

    const [result] = await connection.execute(
      `
      INSERT INTO user_songbooks_data
        (user_id, songbooks_version, exported_at, book_count, source_file_count, byte_size, chunk_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        nextVersion,
        exportedAt,
        bookCount,
        sourceFileCount,
        Buffer.byteLength(normalizedJson, 'utf8'),
        chunks.length
      ]
    );
    const songbooksDataId = result.insertId;

    for (let index = 0; index < chunks.length; index += 1) {
      await connection.execute(
        `
        INSERT INTO user_songbooks_data_chunks (songbooks_data_id, chunk_index, chunk_text)
        VALUES (?, ?, ?)
        `,
        [songbooksDataId, index, chunks[index]]
      );
    }

    await connection.commit();

    res.json({
      ok: true,
      route: '/saveSongbooks',
      id: songbooksDataId,
      userId,
      songbooksVersion: nextVersion,
      bookCount,
      sourceFileCount,
      chunkCount: chunks.length,
      exportedAt
    });
  } catch (error) {
    await connection.rollback();
    console.error('Save songbooks failed:', error);
    const connectionReset = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ER_NET_PACKET_TOO_LARGE'].includes(error?.code);

    res.status(500).json({
      error: connectionReset
        ? 'Failed to save songbooks because the database connection was reset. Reduce SONGBOOKS_DB_CHUNK_SIZE or increase MySQL max_allowed_packet.'
        : error?.message || 'Failed to save songbooks.'
    });
  } finally {
    connection.release();
    if (uploadedPath) {
      fs.unlink(uploadedPath).catch(() => {});
    }
  }
});

app.get('/saveSongbooks/latest', requireAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

    const row = await getLatestSongbooksRow(userId);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'No saved songbooks backup found.'
      });
    }

    res.json({
      ok: true,
      route: '/saveSongbooks/latest',
      backup: serializeSongbooksRow(row)
    });
  } catch (error) {
    console.error('Get latest songbooks metadata failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to get latest songbooks metadata.'
    });
  }
});

app.get('/saveSongbooks/latest/data', requireAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

    const row = await getLatestSongbooksRow(userId);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'No saved songbooks backup found.'
      });
    }

    const [chunks] = await pool.execute(
      `
      SELECT chunk_text
      FROM user_songbooks_data_chunks
      WHERE songbooks_data_id = ?
      ORDER BY chunk_index ASC
      `,
      [row.id]
    );

    if (chunks.length !== Number(row.chunk_count)) {
      return res.status(500).json({
        error: 'Saved songbooks backup is incomplete.'
      });
    }

    const songbooks = JSON.parse(chunks.map((chunk) => chunk.chunk_text).join(''));

    res.json({
      ok: true,
      route: '/saveSongbooks/latest/data',
      backup: serializeSongbooksRow(row),
      songbooks
    });
  } catch (error) {
    console.error('Load latest songbooks failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to load latest songbooks.'
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
