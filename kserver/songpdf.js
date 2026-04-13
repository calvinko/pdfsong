import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { extractSongbookIndexFromPdf } from './genindex-gpt.js';

const router = express.Router();
const uploadsDir = path.resolve('uploads');

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

router.get('/check', async (_req, res) => {
  res.json({
    ok: true,
    route: 'songpdf/check',
    placeholder: true,
    message: 'Placeholder endpoint for song PDF check.'
  });
});

export default router;
