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
const DB_NAME = 'songbook-pwa-files';
const DB_VERSION = 1;
const FILE_STORE = 'pdfs';

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
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
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

function AppHeader({ fileInputRef, books, onAddFolder, onExportCatalog, onImportCatalog, onFilesChosen, onClear }) {
  return (
    <header className="mb-4 flex flex-col gap-4">
      <div>
        <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
          Offline Songbooks
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Song Book Library</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Browse books, open a song list, and jump straight to the PDF page you need on desktop or mobile.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button className={primaryButtonClass} onClick={onAddFolder}>
          Add folder
        </button>
        <button className={secondaryButtonClass} onClick={() => fileInputRef.current?.click()}>
          Add PDF files
        </button>
        <button className={secondaryButtonClass} onClick={onExportCatalog} disabled={!books.length}>
          Export catalog
        </button>
        <label className={secondaryButtonClass}>
          Import catalog
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImportCatalog(e.target.files[0])}
          />
        </label>
        <button className={dangerGhostButtonClass} onClick={onClear} disabled={!books.length}>
          Clear
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => onFilesChosen(e.target.files)}
        />
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

function SongListPage({ books, updateBook }) {
  const { bookId } = useParams();
  const book = books.find((entry) => entry.id === bookId);
  const [draftTitle, setDraftTitle] = useState(book?.title || '');

  useEffect(() => {
    setDraftTitle(book?.title || '');
  }, [book?.id, book?.title]);

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
      subtitle={`${book.songs.length} song${book.songs.length === 1 ? '' : 's'} · ${book.pageCount || '?'} pages`}
      backTo="/"
      backLabel="Books"
      footer={
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
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Book title</label>
          <input
            className={inputClass}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => updateBook(book.id, { title: draftTitle || book.title })}
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
    </PageFrame>
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

  const book = books.find((entry) => entry.id === bookId) || null;

  const tabs = [
    { label: 'Books', to: '/' },
    { label: 'Songs', to: book ? `/books/${book.id}` : '/' },
  ];

  return (
    <nav className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
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
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    saveCatalog(books);
  }, [books]);

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

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <AppHeader
        fileInputRef={fileInputRef}
        books={books}
        onAddFolder={handleAddFolder}
        onExportCatalog={exportCatalog}
        onImportCatalog={importCatalog}
        onFilesChosen={handleFilesChosen}
        onClear={handleClear}
      />
      <SectionNotice />
      <MobileTabs books={books} />

      <Routes>
        <Route path="/" element={<BooksPage books={books} isRestoringFiles={isRestoringFiles} />} />
        <Route path="/books/:bookId" element={<SongListPage books={books} updateBook={updateBook} />} />
        <Route
          path="/books/:bookId/songs/:songId"
          element={<SongViewerPage books={books} updateBook={updateBook} isRestoringFiles={isRestoringFiles} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
