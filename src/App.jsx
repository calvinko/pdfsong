import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ManagePage from './manage.jsx';



pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = 'songbook-pwa-catalog-v1';
const AUTH_STORAGE_KEY = 'songbook-pwa-auth-v1';
const DB_NAME = 'songbook-pwa-files';
const DB_VERSION = 1;
const FILE_STORE = 'pdfs';
const API_BASE_URL = 'https://biblecircle.org/kapi';

const panelClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const panelHeaderClass = 'border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900';
const panelBodyClass = 'p-0';
const emptyPanelClass = 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';
const pageInputClass =
  'w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45';
const ghostButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45';
const dangerGhostButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45';
const listItemBaseClass = 'block w-full rounded-xl border px-4 py-3 text-left transition';
const listItemClass = `${listItemBaseClass} border-slate-200 bg-white hover:bg-slate-50`;
const listItemActiveClass = `${listItemBaseClass} border-sky-500 bg-sky-50 ring-1 ring-sky-200`;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

function openPdfDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
  });
}

async function withStore(mode, work) {
  const db = await openPdfDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, mode);
    const store = tx.objectStore(FILE_STORE);

    let settled = false;

    const finish = (fn) => (value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    tx.oncomplete = () => {
      db.close();
    };
    tx.onabort = finish(() => {
      db.close();
      reject(tx.error || new Error('IndexedDB transaction was aborted.'));
    });
    tx.onerror = finish(() => {
      db.close();
      reject(tx.error || new Error('IndexedDB transaction failed.'));
    });

    Promise.resolve(work(store)).then(finish(resolve), finish(reject));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

async function savePdfFile(bookId, file) {
  await withStore('readwrite', (store) => requestToPromise(store.put(file, bookId)));
}

async function loadPdfFile(bookId) {
  return withStore('readonly', (store) => requestToPromise(store.get(bookId)));
}

async function deletePdfFile(bookId) {
  await withStore('readwrite', (store) => requestToPromise(store.delete(bookId)));
}

async function clearPdfFiles() {
  await withStore('readwrite', (store) => requestToPromise(store.clear()));
}

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampPage(value, max) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, max || 1));
}

function saveCatalog(books) {
  const lightweight = books.map((book) => ({
    id: book.id,
    title: book.title,
    internalTitle: book.internalTitle || '',
    fileName: book.fileName,
    pageCount: book.pageCount,
    songs: book.songs,
    analysisHandle: book.analysisHandle || '',
    analysisStatus: book.analysisStatus || '',
    analysisFilename: book.analysisFilename || '',
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
}

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStoredAuth(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function fileToPdfDoc(file) {
  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: buffer }).promise;
}

async function apiRequest(path, options = {}) {
  const defaultHeaders = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
}

function getAuthToken(authSession) {
  return (
    authSession?.token ||
    authSession?.accessToken ||
    authSession?.jwt ||
    authSession?.sessionToken ||
    authSession?.user?.token ||
    ''
  );
}

async function apiAuthedRequest(path, authSession, options = {}) {
  const token = getAuthToken(authSession);

  return apiRequest(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

async function uploadBookForAnalysis(book, authSession) {
  if (!book.file) {
    throw new Error('This book needs its PDF file before analysis can start.');
  }

  const formData = new FormData();
  formData.append('pdf', book.file, book.fileName || book.file.name || `${book.title}.pdf`);

  return apiAuthedRequest('/songpdf/analyze', authSession, {
    method: 'POST',
    body: formData,
  });
}

async function fetchAnalysisStatus(book, authSession) {
  if (!book.analysisHandle) {
    throw new Error('Run Analyze first so this book has an analysis handle.');
  }

  const query = new URLSearchParams({
    handle: book.analysisHandle,
    _: `${Date.now()}`
  });
  return apiAuthedRequest(`/songpdf/getstatus?${query.toString()}`, authSession, {
    cache: 'no-store'
  });
}

async function resolveOutlinePage(pdf, dest) {
  if (!dest) {
    return null;
  }

  const resolvedDest = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
  if (!Array.isArray(resolvedDest) || resolvedDest.length === 0) {
    return null;
  }

  const target = resolvedDest[0];

  if (typeof target === 'number' && Number.isFinite(target)) {
    return target + 1;
  }

  if (target && typeof target === 'object' && 'num' in target) {
    const pageIndex = await pdf.getPageIndex(target);
    return pageIndex + 1;
  }

  return null;
}

async function extractSongIndex(file) {
  const pdf = await fileToPdfDoc(file);
  const metadata = await pdf.getMetadata().catch(() => null);
  const outline = await pdf.getOutline();
  const documentTitle =
    String(
      metadata?.info?.Title ||
      metadata?.metadata?.get?.('dc:title') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim() || null;

  if (!Array.isArray(outline) || outline.length === 0) {
    return {
      title: documentTitle, 
      pageCount: pdf.numPages,
      songs: []
    };
  }

  const songs = [];

  async function visit(items) {
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const title = String(item.title || '').replace(/\s+/g, ' ').trim();
      const page = await resolveOutlinePage(pdf, item.dest);

      if (title && Number.isFinite(page) && page > 0) {
        songs.push({
          id: uid('song'),
          title,
          page: Math.round(page)
        });
      }

      if (Array.isArray(item.items) && item.items.length > 0) {
        await visit(item.items);
      }
    }
  }

  await visit(outline);

  return {
    title: documentTitle,
    pageCount: pdf.numPages,
    songs
  };
}

function normalizeAnalyzedSongs(payload) {
  const rawSongs = payload?.result?.data?.songs;
  if (!Array.isArray(rawSongs)) {
    return [];
  }

  return rawSongs
    .map((song) => {
      const title = String(song?.title || '').trim();
      const page = Number(song?.page);

      if (!title || !Number.isFinite(page) || page <= 0) {
        return null;
      }

      return {
        id: uid('song'),
        title,
        page: Math.round(page)
      };
    })
    .filter(Boolean);
}

function bookFromStored(book) {
  return {
    ...book,
    file: null,
    url: null,
    missingFile: true,
    internalTitle: book.internalTitle || '',
    analysisHandle: book.analysisHandle || '',
    analysisStatus: book.analysisStatus || '',
    analysisFilename: book.analysisFilename || '',
  };
}

function attachFileToBook(book, file) {
  if (!file) return bookFromStored(book);

  return {
    ...book,
    file,
    url: URL.createObjectURL(file),
    missingFile: false,
  };
}

function revokeBookUrls(books) {
  books.forEach((book) => {
    if (book.url) URL.revokeObjectURL(book.url);
  });
}

function normalizeBookKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getBookKeys(values) {
  const keys = new Set();

  values.forEach((value) => {
    const normalized = normalizeBookKey(value);
    if (!normalized) return;

    keys.add(normalized);
    keys.add(normalized.replace(/\s+/g, ''));
  });

  return keys;
}

function sortBooksByTitle(books) {
  return [...books].sort((a, b) =>
    String(a.title || '').localeCompare(String(b.title || ''), undefined, {
      sensitivity: 'base',
      numeric: true
    })
  );
}

async function booksFromFiles(files, existingBooks = [], onProgress, options = {}) {
  const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
  const books = [];
  const knownBookKeys = new Set();
  const allowDuplicates = options.allowDuplicates === true;

  existingBooks.forEach((book) => {
    getBookKeys([book.fileName, book.title, book.internalTitle]).forEach((key) => {
      knownBookKeys.add(key);
    });
  });

  onProgress?.({
    total: pdfFiles.length,
    processed: 0,
    currentFile: pdfFiles[0]?.name || '',
    items: pdfFiles.map((file) => ({
      id: uid('import'),
      name: file.name,
      state: 'queued',
      file
    }))
  });

  for (const file of pdfFiles) {
    const filenameTitle = file.name.replace(/\.pdf$/i, '');
    const fileKeys = getBookKeys([file.name, filenameTitle]);

    if (!allowDuplicates && [...fileKeys].some((key) => knownBookKeys.has(key))) {
      onProgress?.((current) => ({
        ...current,
        processed: current.processed + 1,
        currentFile: file.name,
        items: current.items.map((item) =>
          item.name === file.name
            ? {
                ...item,
                state: 'skipped',
                metadata: {
                  reason: 'Duplicate book already exists in the library.'
                }
              }
            : item
        )
      }));
      continue;
    }

    onProgress?.((current) => ({
      ...current,
      currentFile: file.name,
      items: current.items.map((item) =>
        item.name === file.name && item.state === 'queued' ? { ...item, state: 'processing' } : item
      )
    }));

    try {
      const { title, songs, pageCount } = await extractSongIndex(file);
      const extractedKeys = getBookKeys([file.name, filenameTitle, title]);

      if (!allowDuplicates && [...extractedKeys].some((key) => knownBookKeys.has(key))) {
        onProgress?.((current) => ({
          ...current,
          processed: current.processed + 1,
          items: current.items.map((item) =>
            item.name === file.name
              ? {
                  ...item,
                  state: 'skipped',
                  metadata: {
                    internalTitle: title || '',
                    reason: 'Duplicate internal title already exists in the library.'
                  }
                }
              : item
          )
        }));
        continue;
      }

      const book = {
        id: uid('book'),
        title: filenameTitle,
        internalTitle: title || '',
        fileName: file.name,
        file,
        pageCount,
        songs,
        analysisHandle: '',
        analysisStatus: '',
        analysisFilename: '',
      };
      await savePdfFile(book.id, file);
      books.push(attachFileToBook(book, file));
      getBookKeys([book.fileName, book.title, book.internalTitle]).forEach((key) => {
        knownBookKeys.add(key);
      });

      onProgress?.((current) => ({
        ...current,
        processed: current.processed + 1,
        items: current.items.map((item) =>
          item.name === file.name
            ? {
                ...item,
                state: 'done',
                metadata: {
                  internalTitle: title || '',
                  pageCount,
                  songCount: songs.length
                }
              }
            : item
        )
      }));
    } catch (error) {
      onProgress?.((current) => ({
        ...current,
        processed: current.processed + 1,
        items: current.items.map((item) =>
          item.name === file.name ? { ...item, state: 'error' } : item
        )
      }));
      throw error;
    }
  }

  return books;
}

async function pickFolderFiles() {
  if (!window.showDirectoryPicker) {
    throw new Error('Folder picker is not supported in this browser. Use “Add PDF files” instead.');
  }

  const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
  const files = [];

  for await (const [, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && handle.name.toLowerCase().endsWith('.pdf')) {
      files.push(await handle.getFile());
    }
  }

  return files;
}

function TopIconLink({ to, active, label, children }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
        active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </Link>
  );
}

function AppHeader() {
  const location = useLocation();
  const onManagePage = location.pathname.startsWith('/manage');

  return (
    <header className="mb-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            My Song Books
          </div>
          {onManagePage ? (
            <>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Song Book Library</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Browse books, open a song list, and jump straight to the PDF page you need on desktop or mobile.
              </p>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <TopIconLink to="/" active={!onManagePage} label="Main song page">
            <HomeIcon />
          </TopIconLink>
          <TopIconLink to="/manage" active={onManagePage} label="Manage library">
            <SettingsIcon />
          </TopIconLink>
        </div>
      </div>
    </header>
  );
}

function PageFrame({ title, subtitle, backTo, backLabel, headerAction, children, footer }) {
  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className={panelHeaderClass}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm font-normal text-slate-500">{subtitle}</div> : null}
          </div>
          {(headerAction || backTo) ? (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction ? headerAction : null}
              {backTo ? (
                <Link to={backTo} className={secondaryButtonClass}>
                  {backLabel || 'Back'}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className={panelBodyClass}>{children}</div>
      {footer ? <div className="border-t border-slate-200 p-4">{footer}</div> : null}
    </section>
  );
}

function BooksPage({ books, isRestoringFiles }) {
  if (isRestoringFiles) {
    return (
      <PageFrame title="Books" subtitle="Restoring saved PDFs">
        <div className={emptyPanelClass}>Restoring saved PDFs…</div>
      </PageFrame>
    );
  }

  return (
    <PageFrame title="Books" subtitle={`${books.length} book${books.length === 1 ? '' : 's'} in your library`}>
      {books.length === 0 ? (
        <div className={emptyPanelClass}>No books loaded yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {books.map((book) => (
            <div key={book.id} className={listItemClass}>
              <div className="flex items-start justify-between gap-3">
                <Link to={`/books/${book.id}`} className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{book.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {book.songs.length} songs · {book.pageCount || '?'} pages
                    {book.missingFile ? ' · relink needed' : ''}
                  </div>
                </Link>
                {!book.missingFile && book.url ? (
                  <a
                    className={`${secondaryButtonClass} shrink-0 px-3 py-1.5 text-xs`}
                    href={book.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function SongListPage({ books }) {
  const { bookId } = useParams();
  const book = books.find((entry) => entry.id === bookId);

  if (!book) {
    return (
      <PageFrame title="Book not found" backTo="/" backLabel="Books">
        <div className={emptyPanelClass}>This book is no longer available.</div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      title={book.title}
      subtitle={`${book.songs.length} song${book.songs.length === 1 ? '' : 's'} · tap a title to open the PDF`}
      backTo="/"
      backLabel="Books"
    >
      {book.songs.length === 0 ? (
        <div className={emptyPanelClass}>No songs are available for this book yet. Use Manage to add or edit songs.</div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-200">
          {book.songs
            .slice()
            .sort((a, b) => a.page - b.page || a.title.localeCompare(b.title))
            .map((song) => (
              <Link
                key={song.id}
                to={`/books/${book.id}/songs/${song.id}`}
                className="flex items-baseline justify-between gap-3 py-2 text-sm transition hover:bg-slate-50"
              >
                <span className="min-w-0 truncate font-medium text-slate-900">{song.title}</span>
                <span className="shrink-0 text-xs text-slate-500">p. {song.page}</span>
              </Link>
            ))}
        </div>
      )}
    </PageFrame>
  );
}

function PdfControlBar({ className = '', onZoomOut, onZoomIn, onPrevPage, onNextPage, onPrevSong, onNextSong }) {
  return (
    <div className={className}>
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/35 px-3 py-2 opacity-45 shadow-lg backdrop-blur transition hover:bg-white/95 hover:opacity-100 focus-within:bg-white/95 focus-within:opacity-100">
        <button
          className={ghostButtonClass}
          onClick={onZoomOut}
          aria-label="Decrease size"
          title="Decrease size"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8.5" cy="8.5" r="4.5" />
            <path d="M12 12l4 4" />
            <path d="M6.5 8.5h4" />
          </svg>
        </button>
        <button
          className={ghostButtonClass}
          onClick={onZoomIn}
          aria-label="Increase size"
          title="Increase size"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8.5" cy="8.5" r="4.5" />
            <path d="M12 12l4 4" />
            <path d="M8.5 6.5v4" />
            <path d="M6.5 8.5h4" />
          </svg>
        </button>
        <button className={ghostButtonClass} onClick={onPrevPage} aria-label="Previous page" title="Previous page">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 4.5L7 10l5.5 5.5" />
          </svg>
        </button>
        <button className={ghostButtonClass} onClick={onNextPage} aria-label="Next page" title="Next page">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 4.5L13 10l-5.5 5.5" />
          </svg>
        </button>
        <button className={ghostButtonClass} onClick={onPrevSong} aria-label="Previous song" title="Previous song">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4.5L5.5 10 11 15.5" />
            <path d="M15 4.5L9.5 10 15 15.5" />
          </svg>
        </button>
        <button className={ghostButtonClass} onClick={onNextSong} aria-label="Next song" title="Next song">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4.5L14.5 10 9 15.5" />
            <path d="M5 4.5L10.5 10 5 15.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PdfViewer({ file, url, pageNumber, onPageCount, pageCount, zoomScale, controls }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!file || !url || !canvasRef.current) return;
      setLoading(true);
      setError('');
      try {
        const pdf = await fileToPdfDoc(file);
        if (cancelled) return;
        onPageCount(pdf.numPages);
        const safePage = clampPage(pageNumber, pdf.numPages);
        const page = await pdf.getPage(safePage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: zoomScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Could not display this PDF page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [file, url, pageNumber, onPageCount, zoomScale]);

  if (!file || !url) return <div className={emptyPanelClass}>Select a song to open its PDF page.</div>;

  return (
    <div className="flex flex-col gap-3">
      {loading ? <div className={emptyPanelClass}>Rendering page…</div> : null}
      {error ? <div className={`${emptyPanelClass} text-rose-600`}>{error}</div> : null}
      <div className="relative overflow-auto border border-slate-200 bg-slate-50 p-0">
        <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full rounded-lg bg-white shadow-sm" />
        {controls ? <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center md:hidden">{controls}</div> : null}
      </div>
    </div>
  );
}

function SongViewerPage({ books, updateBook, isRestoringFiles }) {
  const { bookId, songId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const book = books.find((entry) => entry.id === bookId);
  const song = book?.songs.find((entry) => entry.id === songId) || null;

  const currentPage = useMemo(() => {
    if (!book || !song) return 1;
    const fromQuery = searchParams.get('page');
    return clampPage(fromQuery || song.page, book.pageCount || song.page);
  }, [book, song, searchParams]);

  useEffect(() => {
    if (!book || !song) return;
    const fromQuery = searchParams.get('page');
    const safePage = String(clampPage(fromQuery || song.page, book.pageCount || song.page));
    if (fromQuery !== safePage) {
      setSearchParams({ page: safePage }, { replace: true });
    }
  }, [book, song, searchParams, setSearchParams]);

  if (!book || !song) {
    return (
      <PageFrame title="Song not found" backTo={book ? `/books/${book.id}` : '/'} backLabel={book ? 'Songs' : 'Books'}>
        <div className={emptyPanelClass}>This song is no longer available.</div>
      </PageFrame>
    );
  }

  const goToPage = (value) => {
    setSearchParams({ page: String(clampPage(value, book.pageCount || currentPage)) });
  };

  const songIndex = book.songs.findIndex((entry) => entry.id === song.id);
  const [zoomScale, setZoomScale] = useState(() => (window.innerWidth < 640 ? 1.5 : 2));

  const goToSong = (offset) => {
    if (songIndex === -1) return;

    const nextSong = book.songs[songIndex + offset];
    if (!nextSong) return;

    navigate(`/books/${book.id}/songs/${nextSong.id}?page=${nextSong.page}`);
  };

  const controls = (
    <PdfControlBar
      onZoomOut={() => setZoomScale((current) => Math.max(1, current - 0.25))}
      onZoomIn={() => setZoomScale((current) => Math.min(4, current + 0.25))}
      onPrevPage={() => goToPage(currentPage - 1)}
      onNextPage={() => goToPage(currentPage + 1)}
      onPrevSong={() => goToSong(-1)}
      onNextSong={() => goToSong(1)}
    />
  );

  return (
    <PageFrame
      title={song.title}
      subtitle={`${book.title} · page ${currentPage} of ${book.pageCount || '?'}`}
      backTo={`/books/${book.id}`}
      backLabel="Songs"
      headerAction={<div className="hidden md:block">{controls}</div>}
    >
      {isRestoringFiles ? (
        <div className={emptyPanelClass}>Restoring saved PDFs…</div>
      ) : book.missingFile ? (
        <div className={emptyPanelClass}>This book was restored without its PDF file. Re-add the PDF to open pages.</div>
      ) : (
        <PdfViewer
          file={book.file}
          url={book.url}
          pageNumber={currentPage}
          pageCount={book.pageCount}
          zoomScale={zoomScale}
          controls={controls}
          onPageCount={(count) => {
            if (count !== book.pageCount) {
              updateBook(book.id, { pageCount: count });
            }
          }}
        />
      )}
    </PageFrame>
  );
}

export default function App() {
  const [books, setBooks] = useState(() => loadCatalog().map(bookFromStored));
  const [isRestoringFiles, setIsRestoringFiles] = useState(true);
  const [authSession, setAuthSession] = useState(() => loadStoredAuth());
  const [importStatus, setImportStatus] = useState({
    visible: false,
    message: '',
    total: 0,
    processed: 0,
    currentFile: '',
    items: []
  });
  const fileInputRef = useRef(null);
  const catalogInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    saveCatalog(books);
  }, [books]);

  useEffect(() => {
    if (authSession) {
      saveStoredAuth(authSession);
    } else {
      clearStoredAuth();
    }
  }, [authSession]);

  useEffect(() => {
    let cancelled = false;

    async function restoreFiles() {
      const storedBooks = loadCatalog();
      const restored = await Promise.all(
        storedBooks.map(async (book) => attachFileToBook(book, await loadPdfFile(book.id)))
      );

      if (!cancelled) {
        setBooks((current) => {
          revokeBookUrls(current);
          return restored;
        });
        setIsRestoringFiles(false);
      }
    }

    restoreFiles().catch((error) => {
      console.error(error);
      if (!cancelled) setIsRestoringFiles(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const knownIds = new Set(books.map((book) => book.id));

    withStore('readwrite', async (store) => {
      const keys = await requestToPromise(store.getAllKeys());
      await Promise.all(keys.filter((key) => !knownIds.has(key)).map((key) => requestToPromise(store.delete(key))));
    }).catch((error) => {
      console.error(error);
    });
  }, [books]);

  useEffect(() => {
    return () => {
      revokeBookUrls(books);
    };
  }, [books]);

  function updateBook(bookId, patch) {
    setBooks((current) =>
      current.map((book) => {
        if (book.id !== bookId) return book;
        return { ...book, ...patch };
      })
    );
  }

  function reorderBooks(sourceBookId, targetBookId) {
    setBooks((current) => {
      const sourceIndex = current.findIndex((book) => book.id === sourceBookId);
      const targetIndex = current.findIndex((book) => book.id === targetBookId);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  async function handleAddFolder() {
    try {
      const files = await pickFolderFiles();
      setImportStatus({
        visible: true,
        message: 'Preparing PDF import…',
        total: 0,
        processed: 0,
        currentFile: '',
        items: []
      });
      const newBooks = await booksFromFiles(files, books, (next) => {
        setImportStatus((current) => {
          const value = typeof next === 'function' ? next(current) : next;
          return {
            visible: true,
            message: `Importing song PDFs${value.total ? ` (${value.processed}/${value.total})` : ''}…`,
            ...value
          };
        });
      });
      setBooks((current) => sortBooksByTitle([...current, ...newBooks]));
      setImportStatus((current) => ({
        ...current,
        visible: true,
        currentFile: '',
        message: `Import finished. Added ${newBooks.length} book${newBooks.length === 1 ? '' : 's'}.`
      }));
      navigate('/');
    } catch (error) {
      setImportStatus((current) => ({
        ...current,
        visible: true,
        message: error.message || 'Unable to load folder.'
      }));
    }
  }

  async function handleFilesChosen(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      setImportStatus({
        visible: true,
        message: 'Preparing PDF import…',
        total: 0,
        processed: 0,
        currentFile: '',
        items: []
      });
      const newBooks = await booksFromFiles(files, books, (next) => {
        setImportStatus((current) => {
          const value = typeof next === 'function' ? next(current) : next;
          return {
            visible: true,
            message: `Importing song PDFs${value.total ? ` (${value.processed}/${value.total})` : ''}…`,
            ...value
          };
        });
      });
      setBooks((current) => sortBooksByTitle([...current, ...newBooks]));
      setImportStatus((current) => ({
        ...current,
        visible: true,
        currentFile: '',
        message: `Import finished. Added ${newBooks.length} book${newBooks.length === 1 ? '' : 's'}.`
      }));
      navigate('/');
    } catch (error) {
      setImportStatus((current) => ({
        ...current,
        visible: true,
        message: error.message || 'Unable to read PDF files.'
      }));
    }
  }

  async function handleImportAnyway(item) {
    if (!item?.file) return;

    setImportStatus({
      visible: true,
      message: 'Importing duplicate book…',
      total: 0,
      processed: 0,
      currentFile: '',
      items: []
    });

    try {
      const newBooks = await booksFromFiles([item.file], books, (next) => {
        setImportStatus((current) => {
          const value = typeof next === 'function' ? next(current) : next;
          return {
            visible: true,
            message: `Importing song PDFs${value.total ? ` (${value.processed}/${value.total})` : ''}…`,
            ...value
          };
        });
      }, { allowDuplicates: true });

      setBooks((current) => sortBooksByTitle([...current, ...newBooks]));
      setImportStatus((current) => ({
        ...current,
        visible: true,
        currentFile: '',
        message: `Import finished. Added ${newBooks.length} book${newBooks.length === 1 ? '' : 's'}.`
      }));
    } catch (error) {
      setImportStatus((current) => ({
        ...current,
        visible: true,
        message: error.message || 'Unable to import duplicate book.'
      }));
    }
  }

  function exportCatalog() {
    const content = JSON.stringify(
      books.map((book) => ({
        title: book.title,
        internalTitle: book.internalTitle || '',
        fileName: book.fileName,
        pageCount: book.pageCount,
        songs: book.songs,
        analysisHandle: book.analysisHandle || '',
        analysisStatus: book.analysisStatus || '',
        analysisFilename: book.analysisFilename || '',
      })),
      null,
      2
    );
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'songbook-catalog.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCatalog(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const previousBooks = books;
    const imported = parsed.map((book) => ({
      id: uid('book'),
      title: book.title,
      internalTitle: book.internalTitle || '',
      fileName: book.fileName,
      pageCount: book.pageCount,
      songs: (book.songs || []).map((song) => ({
        id: uid('song'),
        title: song.title,
        page: song.page,
      })),
      analysisHandle: book.analysisHandle || '',
      analysisStatus: book.analysisStatus || '',
      analysisFilename: book.analysisFilename || '',
      file: null,
      url: null,
      missingFile: true,
    }));
    await clearPdfFiles();
    revokeBookUrls(previousBooks);
    setBooks(imported);
    navigate(imported[0] ? `/books/${imported[0].id}` : '/');
  }

  async function handleClear() {
    revokeBookUrls(books);
    await clearPdfFiles();
    setBooks([]);
    navigate('/');
  }

  async function handleDeleteBook(book) {
    if (!book) return;

    if (book.url) {
      URL.revokeObjectURL(book.url);
    }

    await deletePdfFile(book.id);
    setBooks((current) => current.filter((entry) => entry.id !== book.id));
    navigate('/');
  }

  function handleAuthSuccess(session) {
    setAuthSession(session);
  }

  function handleLogout() {
    setAuthSession(null);
  }

  async function handleAnalyze(book) {
    updateBook(book.id, {
      analysisLoading: true,
      statusLoading: false,
      analysisError: '',
      analysisSuccess: '',
    });

    try {
      const payload = await uploadBookForAnalysis(book, authSession);
      updateBook(book.id, {
        analysisLoading: false,
        analysisError: '',
        analysisHandle: payload.handle || '',
        analysisFilename: payload.localFilename || payload.filename || '',
        analysisStatus: payload.status || 'queued',
        analysisSuccess: payload.handle ? `Analysis started. Handle: ${payload.handle}` : 'Analysis started.',
      });
    } catch (error) {
      updateBook(book.id, {
        analysisLoading: false,
        analysisError: error.message || 'Unable to start analysis for this book.',
        analysisSuccess: '',
      });
    }
  }

  async function handleGetStatus(book) {
    updateBook(book.id, {
      statusLoading: true,
      analysisError: '',
      analysisSuccess: '',
    });

    try {
      const payload = await fetchAnalysisStatus(book, authSession);
      const status = payload.status || 'unknown';
      const completedSongs = status === 'completed' ? normalizeAnalyzedSongs(payload) : [];

      updateBook(book.id, {
        statusLoading: false,
        analysisError: '',
        analysisStatus: status,
        songs: completedSongs.length ? completedSongs : book.songs,
        analysisSuccess:
          status === 'completed'
            ? completedSongs.length
              ? `Analysis completed. Loaded ${completedSongs.length} song${completedSongs.length === 1 ? '' : 's'}.`
              : 'Analysis completed, but no songs were returned.'
            : `Analysis status: ${status}`,
      });
    } catch (error) {
      updateBook(book.id, {
        statusLoading: false,
        analysisError: error.message || 'Unable to get analysis status for this book.',
        analysisSuccess: '',
      });
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <AppHeader />

      <Routes>
        <Route path="/" element={<BooksPage books={books} isRestoringFiles={isRestoringFiles} />} />
        <Route path="/books/:bookId" element={<SongListPage books={books} />} />
        <Route
          path="/manage"
          element={
            <ManagePage
              books={books}
              isRestoringFiles={isRestoringFiles}
              authSession={authSession}
              importStatus={importStatus}
              fileInputRef={fileInputRef}
              catalogInputRef={catalogInputRef}
              onAddFolder={handleAddFolder}
              onFilesChosen={handleFilesChosen}
              onExportCatalog={exportCatalog}
              onImportCatalog={importCatalog}
              onClear={handleClear}
              onDeleteBook={handleDeleteBook}
              onReorderBooks={reorderBooks}
              onDismissImportStatus={() => {
                setImportStatus((current) => ({ ...current, visible: false }));
                navigate('/manage');
              }}
              onImportAnyway={handleImportAnyway}
              onAuthSuccess={handleAuthSuccess}
              onLogout={handleLogout}
              updateBook={updateBook}
              onAnalyze={handleAnalyze}
              onGetStatus={handleGetStatus}
              apiRequest={apiRequest}
              uid={uid}
              clampPage={clampPage}
              PageFrame={PageFrame}
              styles={{
                panelClass,
                panelHeaderClass,
                panelBodyClass,
                emptyPanelClass,
                inputClass,
                pageInputClass,
                secondaryButtonClass,
                primaryButtonClass,
                dangerGhostButtonClass,
              }}
            />
          }
        />
        <Route
          path="/books/:bookId/songs/:songId"
          element={<SongViewerPage books={books} updateBook={updateBook} isRestoringFiles={isRestoringFiles} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
