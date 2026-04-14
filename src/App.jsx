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

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = 'songbook-pwa-catalog-v1';
const AUTH_STORAGE_KEY = 'songbook-pwa-auth-v1';
const DB_NAME = 'songbook-pwa-files';
const DB_VERSION = 1;
const FILE_STORE = 'pdfs';
const API_BASE_URL = 'https://biblecircle.org/kapi';

const panelClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const panelHeaderClass = 'border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900';
const panelBodyClass = 'p-4';
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

async function extractSongSuggestions(file) {
  const pdf = await fileToPdfDoc(file);
  const textPages = [];
  const maxPages = Math.min(pdf.numPages, 8);

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item) => item.str)
      .join('\n')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    textPages.push(...lines);
  }

  const patterns = [
    /^(\d{1,3})[.)\-\s]+(.+?)\s+(\d{1,4})$/,
    /^(.+?)\.{2,}\s*(\d{1,4})$/,
    /^(.+?)\s+(\d{1,4})$/,
  ];

  const results = [];
  const seen = new Set();

  for (const line of textPages) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      let title;
      let page;
      if (match.length === 4) {
        title = match[2]?.trim();
        page = Number(match[3]);
      } else {
        title = match[1]?.trim();
        page = Number(match[2]);
      }

      if (!title || !Number.isFinite(page) || page <= 0) continue;
      if (title.length < 2 || /^page\s*\d+$/i.test(title)) continue;
      const key = `${title.toLowerCase()}::${page}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ id: uid('song'), title, page });
      break;
    }
  }

  return {
    pageCount: pdf.numPages,
    songs: results.slice(0, 300),
  };
}

function bookFromStored(book) {
  return {
    ...book,
    file: null,
    url: null,
    missingFile: true,
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

async function booksFromFiles(files) {
  const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
  const books = [];

  for (const file of pdfFiles) {
    const { songs, pageCount } = await extractSongSuggestions(file);
    const book = {
      id: uid('book'),
      title: file.name.replace(/\.pdf$/i, ''),
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
            Offline Songbooks
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Song Book Library</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Browse books, open a song list, and jump straight to the PDF page you need on desktop or mobile.
          </p>
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

function SectionNotice() {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
      On Android Chrome and desktop Chromium browsers, <strong>Add folder</strong> can open a local directory. On browsers without
      folder access, use <strong>Add PDF files</strong>. PDFs are cached in IndexedDB after the first import.
    </div>
  );
}

function PageFrame({ title, subtitle, backTo, backLabel, children, footer }) {
  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className={panelHeaderClass}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm font-normal text-slate-500">{subtitle}</div> : null}
          </div>
          {backTo ? (
            <Link to={backTo} className={secondaryButtonClass}>
              {backLabel || 'Back'}
            </Link>
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
            <Link key={book.id} to={`/books/${book.id}`} className={listItemClass}>
              <div className="text-sm font-semibold text-slate-900">{book.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {book.songs.length} songs · {book.pageCount || '?'} pages
                {book.missingFile ? ' · relink needed' : ''}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function BookSongEditor({ book, updateBook }) {
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Book title</label>
        <input
          className={inputClass}
          value={book.title}
          onChange={(e) => updateBook(book.id, { title: e.target.value })}
        />
      </div>

      {book.songs.length === 0 ? (
        <div className={emptyPanelClass}>No songs found automatically. Add them manually to start building the list.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {book.songs
            .slice()
            .sort((a, b) => a.page - b.page || a.title.localeCompare(b.title))
            .map((song, index) => (
              <div key={song.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{song.title}</div>
                    <div className="text-xs text-slate-500">Song {index + 1}</div>
                  </div>
                  <Link
                    to={`/books/${book.id}/songs/${song.id}`}
                    className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
                  >
                    Open
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_92px_auto]">
                  <input
                    className={inputClass}
                    value={song.title}
                    onChange={(e) =>
                      updateBook(book.id, {
                        songs: book.songs.map((entry) =>
                          entry.id === song.id ? { ...entry, title: e.target.value } : entry
                        ),
                      })
                    }
                  />
                  <input
                    className={`${pageInputClass} w-full`}
                    type="number"
                    min="1"
                    max={book.pageCount || 1}
                    value={song.page}
                    onChange={(e) =>
                      updateBook(book.id, {
                        songs: book.songs.map((entry) =>
                          entry.id === song.id
                            ? { ...entry, page: clampPage(e.target.value, book.pageCount) }
                            : entry
                        ),
                      })
                    }
                  />
                  <button
                    className={dangerGhostButtonClass}
                    onClick={() =>
                      updateBook(book.id, {
                        songs: book.songs.filter((entry) => entry.id !== song.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ManagePage({
  books,
  isRestoringFiles,
  authSession,
  fileInputRef,
  catalogInputRef,
  onAddFolder,
  onFilesChosen,
  onExportCatalog,
  onImportCatalog,
  onClear,
  onAuthSuccess,
  onLogout,
  updateBook,
  onAnalyze,
  onGetStatus,
}) {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      const payload =
        authMode === 'register'
          ? {
              email: authForm.email,
              password: authForm.password,
              displayName: authForm.displayName,
            }
          : {
              email: authForm.email,
              password: authForm.password,
            };

      const session = await apiRequest(`/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onAuthSuccess(session);
      setAuthSuccess(authMode === 'register' ? 'Registration successful.' : 'Login successful.');
      setAuthForm((current) => ({ ...current, password: '' }));
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageFrame title="Account" subtitle="Register or log in from the app">
        {authSession ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {authSession.user?.email || 'Signed in'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {authSession.user?.userUuid ? `User ID: ${authSession.user.userUuid}` : 'Session active'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={dangerGhostButtonClass} onClick={onLogout}>
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                type="button"
              >
                Register
              </button>
            </div>

            <form className="flex flex-col gap-3" onSubmit={handleAuthSubmit}>
              {authMode === 'register' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Display name</label>
                  <input
                    className={inputClass}
                    value={authForm.displayName}
                    onChange={(e) => setAuthForm((current) => ({ ...current, displayName: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  className={inputClass}
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input
                  className={inputClass}
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'}
                  required
                />
              </div>

              {authError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</div> : null}
              {authSuccess ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authSuccess}</div> : null}

              <button className={primaryButtonClass} type="submit" disabled={authSubmitting}>
                {authSubmitting ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Log in'}
              </button>
            </form>
          </div>
        )}
      </PageFrame>

      <PageFrame title="Manage Library" subtitle="Import, export, add books, and add songs from one place">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className={primaryButtonClass} onClick={onAddFolder}>
            Add folder
          </button>
          <button className={secondaryButtonClass} onClick={() => fileInputRef.current?.click()}>
            Add PDF files
          </button>
          <button className={secondaryButtonClass} onClick={onExportCatalog} disabled={!books.length}>
            Export catalog
          </button>
          <button className={secondaryButtonClass} onClick={() => catalogInputRef.current?.click()}>
            Import catalog
          </button>
          <button className={`${dangerGhostButtonClass} sm:col-span-2`} onClick={onClear} disabled={!books.length}>
            Clear library
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        <input
          ref={catalogInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onImportCatalog(e.target.files[0])}
        />
      </PageFrame>

      <PageFrame title="Books" subtitle="Add a song directly into any book">
        {isRestoringFiles ? (
          <div className={emptyPanelClass}>Restoring saved PDFs…</div>
        ) : books.length === 0 ? (
          <div className={emptyPanelClass}>No books loaded yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {books.map((book) => (
              <div key={book.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{book.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {book.songs.length} songs · {book.pageCount || '?'} pages
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={secondaryButtonClass}
                      onClick={() =>
                        updateBook(book.id, {
                          songs: [...book.songs, { id: uid('song'), title: 'New song', page: 1 }],
                        })
                      }
                    >
                      Add song
                    </button>
                    <button
                      className={secondaryButtonClass}
                      onClick={() => onAnalyze(book)}
                      disabled={book.analysisLoading || book.statusLoading || book.missingFile}
                    >
                      {book.analysisLoading ? 'Analyzing…' : 'Analyze'}
                    </button>
                    <button
                      className={secondaryButtonClass}
                      onClick={() => onGetStatus(book)}
                      disabled={book.analysisLoading || book.statusLoading || !book.analysisHandle}
                    >
                      {book.statusLoading ? 'Checking status…' : 'Get status'}
                    </button>
                  </div>
                </div>
                {book.analysisError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {book.analysisError}
                  </div>
                ) : book.missingFile ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Re-add the PDF file before starting analysis.
                  </div>
                ) : null}
                {book.analysisSuccess ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {book.analysisSuccess}
                  </div>
                ) : null}
                {book.analysisHandle ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    Handle: {book.analysisHandle}
                    {book.analysisStatus ? ` · Status: ${book.analysisStatus}` : ''}
                  </div>
                ) : null}
                <BookSongEditor book={book} updateBook={updateBook} />
              </div>
            ))}
          </div>
        )}
      </PageFrame>
    </div>
  );
}

function PdfViewer({ file, url, pageNumber, onPageCount, pageCount, title }) {
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

        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
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
  }, [file, url, pageNumber, onPageCount]);

  if (!file || !url) return <div className={emptyPanelClass}>Select a song to open its PDF page.</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">
          Page {pageNumber} of {pageCount || '?'}
        </div>
      </div>
      {loading ? <div className={emptyPanelClass}>Rendering page…</div> : null}
      {error ? <div className={`${emptyPanelClass} text-rose-600`}>{error}</div> : null}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full rounded-lg bg-white shadow-sm" />
      </div>
      <a className={`${secondaryButtonClass} w-full sm:w-fit`} href={url} target="_blank" rel="noreferrer">
        Open PDF in new tab
      </a>
    </div>
  );
}

function SongViewerPage({ books, updateBook, isRestoringFiles }) {
  const { bookId, songId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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

  return (
    <PageFrame
      title={song.title}
      subtitle={`${book.title} · target page ${song.page}`}
      backTo={`/books/${book.id}`}
      backLabel="Songs"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button className={ghostButtonClass} onClick={() => goToPage(currentPage - 1)}>
            Prev
          </button>
          <input
            className={pageInputClass}
            type="number"
            min="1"
            max={book.pageCount || 1}
            value={currentPage}
            onChange={(e) => goToPage(e.target.value)}
          />
          <button className={ghostButtonClass} onClick={() => goToPage(currentPage + 1)}>
            Next
          </button>
        </div>
      }
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
          onPageCount={(count) => {
            if (count !== book.pageCount) {
              updateBook(book.id, { pageCount: count });
            }
          }}
          title={song.title}
        />
      )}
    </PageFrame>
  );
}

function MobileTabs({ books }) {
  const location = useLocation();
  const { bookId } = useParams();
  const onManagePage = location.pathname.startsWith('/manage');

  const book = books.find((entry) => entry.id === bookId) || null;

  const tabs = [
    { label: 'Books', to: '/' },
    { label: 'Manage', to: '/manage' },
  ];

  return (
    <nav className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active =
          tab.to === '/'
            ? location.pathname === '/'
            : tab.to === '/manage'
              ? onManagePage
              : location.pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.label}
            to={tab.to}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              active ? 'bg-sky-50 text-sky-700' : 'text-slate-600'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [books, setBooks] = useState(() => loadCatalog().map(bookFromStored));
  const [isRestoringFiles, setIsRestoringFiles] = useState(true);
  const [authSession, setAuthSession] = useState(() => loadStoredAuth());
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

  async function handleAddFolder() {
    try {
      const files = await pickFolderFiles();
      const newBooks = await booksFromFiles(files);
      setBooks((current) => [...current, ...newBooks]);
      if (newBooks[0]) navigate(`/books/${newBooks[0].id}`);
    } catch (error) {
      alert(error.message || 'Unable to load folder.');
    }
  }

  async function handleFilesChosen(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      const newBooks = await booksFromFiles(files);
      setBooks((current) => [...current, ...newBooks]);
      if (newBooks[0]) navigate(`/books/${newBooks[0].id}`);
    } catch (error) {
      alert(error.message || 'Unable to read PDF files.');
    }
  }

  function exportCatalog() {
    const content = JSON.stringify(
      books.map((book) => ({
        title: book.title,
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
      <SectionNotice />
      <MobileTabs books={books} />

      <Routes>
        <Route path="/" element={<BooksPage books={books} isRestoringFiles={isRestoringFiles} />} />
        <Route path="/books/:bookId" element={<Navigate to="/manage" replace />} />
        <Route
          path="/manage"
          element={
            <ManagePage
              books={books}
              isRestoringFiles={isRestoringFiles}
              authSession={authSession}
              fileInputRef={fileInputRef}
              catalogInputRef={catalogInputRef}
              onAddFolder={handleAddFolder}
              onFilesChosen={handleFilesChosen}
              onExportCatalog={exportCatalog}
              onImportCatalog={importCatalog}
              onClear={handleClear}
              onAuthSuccess={handleAuthSuccess}
              onLogout={handleLogout}
              updateBook={updateBook}
              onAnalyze={handleAnalyze}
              onGetStatus={handleGetStatus}
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
