import fs from 'node:fs/promises';
import path from 'node:path';

export const analysisStorePath = path.resolve('analysis-handles.json');

async function ensureAnalysisStore() {
  try {
    await fs.access(analysisStorePath);
  } catch {
    await fs.writeFile(analysisStorePath, JSON.stringify({}, null, 2));
  }
}

export async function readAnalysisStore() {
  await ensureAnalysisStore();

  const raw = await fs.readFile(analysisStorePath, 'utf8');
  const parsed = JSON.parse(raw || '{}');

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return parsed;
}

export async function writeAnalysisStore(store) {
  await ensureAnalysisStore();
  await fs.writeFile(analysisStorePath, JSON.stringify(store, null, 2));
}

export async function updateAnalysisRecord(handle, updater) {
  const store = await readAnalysisStore();
  const current = store[handle] || null;
  const next = updater(current);

  if (!next) {
    delete store[handle];
  } else {
    store[handle] = next;
  }

  await writeAnalysisStore(store);
  return next;
}
