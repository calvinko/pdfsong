import express from 'express';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { extractSongbookIndexFromPdf } from './genindex-gpt.js';
import { readAnalysisStore, updateAnalysisRecord } from './analysis-store.js';
import { requireAuth } from './auth.js';

const router = express.Router();
const uploadsDir = path.resolve('uploads');
const backupsDir = path.resolve(uploadsDir, 'backups');

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF files are supported.'));
  }
});

router.post('/getindex', upload.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path || null;
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Upload a PDF file using the pdf form-data field.'
      });
    }

    const result = await extractSongbookIndexFromPdf({
      filePath: req.file.path,
      filename: req.file.originalname || 'songbook.pdf',
      saveOutput: false
    });

    res.json({
      ...result,
      route: 'songpdf/getindex'
    });
  } catch (error) {
    console.error('Song PDF index lookup failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to build song PDF index.'
    });
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath).catch(() => {});
    }
  }
});

router.post('/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Upload a PDF file using the pdf form-data field.'
      });
    }

    const handle = randomUUID();
    const originalFilename = path.basename(req.file.originalname || 'songbook.pdf');
    const analysisFilename = `${handle}-${originalFilename}`;
    const analysisPath = path.join(path.dirname(req.file.path), analysisFilename);

    await fs.copyFile(req.file.path, analysisPath);

    const record = {
      handle,
      path: analysisPath,
      filename: analysisFilename,
      originalFilename,
      status: 'queued'
    };

    await updateAnalysisRecord(handle, () => record);

    extractSongbookIndexFromPdf({
      handle,
      filePath: analysisPath,
      filename: analysisFilename,
      saveOutput: false
    }).catch((error) => {
      console.error(`Song PDF analyze background job failed for ${handle}:`, error);
    });

    res.json({
      ...record,
      route: 'songpdf/analyze',
      placeholder: true
    });
  } catch (error) {
    console.error('Song PDF analyze upload failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to store uploaded PDF for analysis.'
    });
  }
});

router.post('/backup', requireAuth, upload.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path || null;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Upload a PDF file using the pdf form-data field.'
      });
    }

    const userUuid = String(req.auth?.userUuid || '').trim();

    if (!userUuid) {
      return res.status(401).json({
        error: 'Authenticated user is missing a user UUID.'
      });
    }

    const originalFilename = path.basename(req.file.originalname || 'songbook.pdf');
    const userBackupDir = path.join(backupsDir, userUuid);
    const backupPdfPath = path.join(userBackupDir, originalFilename);
    const backupMetaPath = `${backupPdfPath}.json`;
    const songs = (() => {
      try {
        const parsed = JSON.parse(String(req.body.songs || '[]'));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    await fs.mkdir(userBackupDir, { recursive: true });
    await fs.copyFile(req.file.path, backupPdfPath);
    await fs.writeFile(
      backupMetaPath,
      JSON.stringify(
        {
          title: String(req.body.title || '').trim() || originalFilename,
          internalTitle: String(req.body.internalTitle || '').trim(),
          fileName: originalFilename,
          pageCount: Number(req.body.pageCount) || null,
          songCount: Number(req.body.songCount) || songs.length,
          songs,
          userUuid,
          backedUpAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    res.json({
      ok: true,
      route: 'songpdf/backup',
      filename: originalFilename,
      userUuid
    });
  } catch (error) {
    console.error('Song PDF backup failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to back up uploaded PDF.'
    });
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath).catch(() => {});
    }
  }
});

router.get('/getstatus', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const handle = typeof req.query.handle === 'string' ? req.query.handle.trim() : '';

  if (!handle) {
    return res.status(400).json({
      error: 'Provide the analysis handle in the handle query parameter.'
    });
  }

  try {
    const store = await readAnalysisStore();
    const record = store[handle];

    if (!record) {
      return res.status(404).json({
        error: 'Analysis handle not found.'
      });
    }

    res.json({
      ok: true,
      ...record,
      route: 'songpdf/getstatus',
      placeholder: true
    });
  } catch (error) {
    console.error('Song PDF status lookup failed:', error);
    res.status(500).json({
      error: error?.message || 'Failed to read analysis status.'
    });
  }
});

export default router;
