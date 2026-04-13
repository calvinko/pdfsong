import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

dotenv.config();

export const outputsDir = path.resolve('outputs');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SongSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  page: z.number().int().positive()
});

const SongbookIndexSchema = z.object({
  book: z.string().min(1),
  pdf: z.string().min(1),
  songs: z.array(SongSchema)
});

function createSafeBaseName(filename) {
  return (
    path
      .basename(filename, path.extname(filename))
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/^_+|_+$/g, '') || 'songbook'
  );
}

export async function extractSongbookIndexFromPdf({
  filePath,
  filename,
  saveOutput = true
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  if (!filePath || !filename) {
    throw new Error('Both filePath and filename are required.');
  }

  await fs.mkdir(outputsDir, { recursive: true });

  let uploadedFileId = null;

  try {
    const openaiFile = await client.files.create({
      file: await fs.open(filePath, 'r').then((fh) => fh.createReadStream()),
      purpose: 'user_data'
    });
    uploadedFileId = openaiFile.id;

    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || 'gpt-5.4',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You process songbook PDFs. Find the table of contents pages, extract every song title and its PDF page number, preserve duplicates, keep original language, assign sequential IDs starting from 1, and return only structured data. Use the visible book title in the PDF when available; otherwise use the filename as the book name.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file_id: openaiFile.id
            },
            {
              type: 'input_text',
              text: `Extract the table of contents from this songbook PDF and return JSON with this schema:
{
  "book": "<book name>",
  "pdf": "${filename}",
  "songs": [
    { "id": 1, "title": "<song title>", "page": 4 }
  ]
}

Requirements:
- Use PDF page numbers, not printed page numbers if different.
- Preserve duplicate titles.
- Include every song listed in the index.
- Keep titles in the original language.
- Do not shorten titles.
- Clean spacing only.
- Ensure IDs are sequential starting from 1.
- Set the pdf field to "${filename}".`
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(SongbookIndexSchema, 'songbook_index')
      }
    });

    const parsed = response.output_parsed;
    const normalized = {
      ...parsed,
      pdf: filename,
      songs: parsed.songs.map((song, idx) => ({
        id: idx + 1,
        title: song.title.trim(),
        page: song.page
      }))
    };

    const result = {
      ok: true,
      book: normalized.book,
      songs: normalized.songs.length,
      data: normalized
    };

    if (!saveOutput) {
      return result;
    }

    const outFileName = `${createSafeBaseName(filename)}.json`;
    const outPath = path.join(outputsDir, outFileName);

    await fs.writeFile(outPath, JSON.stringify(normalized, null, 2), 'utf8');

    return {
      ...result,
      outputFileName: outFileName,
      outputPath: outPath,
      downloadUrl: `/outputs/${encodeURIComponent(outFileName)}`
    };
  } finally {
    if (uploadedFileId) {
      client.files.delete(uploadedFileId).catch(() => {});
    }
  }
}
