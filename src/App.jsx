import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = 'songbook-pwa-catalog-v1';

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

async function booksFromFiles(files) {
  const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
  const books = [];

  for (const file of pdfFiles) {
    const { songs, pageCount } = await extractSongSuggestions(file);
    books.push({
      id: uid('book'),
      title: file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      pageCount,
      songs,
      missingFile: false,
    });
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

function SongEditor({ book, onBookChange, onOpenSong }) {
  const [draftTitle, setDraftTitle] = useState(book?.title || '');

  useEffect(() => {
    setDraftTitle(book?.title || '');
  }, [book?.id, book?.title]);

  if (!book) {
    return <div className="empty-panel">Choose a book to see its songs.</div>;
  }

  return (
    <div className="panel-body stack-gap">
      <div className="field-row">
        <label className="field-label">Book title</label>
        <input
          className="text-input"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => onBookChange(book.id, { title: draftTitle || book.title })}
        />
      </div>

      <div className="toolbar">
        <button
          className="secondary-btn"
          onClick={() =>
            onBookChange(book.id, {
              songs: [...book.songs, { id: uid('song'), title: 'New song', page: 1 }],
            })
          }
        >
          Add song
        </button>
      </div>

      <div className="song-editor-list">
        {book.songs.length === 0 ? (
          <div className="empty-panel small">
            No songs found automatically. Add them manually, or use a PDF with a readable index page.
          </div>
        ) : null}

        {book.songs.map((song, index) => (
          <div key={song.id} className="song-editor-item">
            <input
              className="text-input"
              value={song.title}
              onChange={(e) => {
                const songs = book.songs.map((entry) =>
                  entry.id === song.id ? { ...entry, title: e.target.value } : entry
                );
                onBookChange(book.id, { songs });
              }}
            />
            <input
              className="page-input"
              type="number"
              min="1"
              max={book.pageCount || 1}
              value={song.page}
              onChange={(e) => {
                const songs = book.songs.map((entry) =>
                  entry.id === song.id
                    ? { ...entry, page: clampPage(e.target.value, book.pageCount) }
                    : entry
                );
                onBookChange(book.id, { songs });
              }}
            />
            <button className="ghost-btn" onClick={() => onOpenSong(song.page)}>
              Open
            </button>
            <button
              className="ghost-btn danger"
              onClick={() => onBookChange(book.id, { songs: book.songs.filter((entry) => entry.id !== song.id) })}
            >
              Remove
            </button>
            <span className="song-index">{index + 1}</span>
          </div>
        ))}
      </div>
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

        const viewport = page.getViewport({ scale: 1.25 });
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

  if (!file || !url) {
    return <div className="empty-panel">Select a song to open its PDF page.</div>;
  }

  return (
    <div className="viewer-wrap">
      <div className="viewer-header">
        <div>
          <div className="viewer-title">{title}</div>
          <div className="viewer-subtitle">
            Page {pageNumber} of {pageCount || '?'}
          </div>
        </div>
        <a className="secondary-btn link-btn" href={url} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      </div>
      {loading ? <div className="status-line">Rendering page…</div> : null}
      {error ? <div className="status-line error">{error}</div> : null}
      <div className="canvas-scroller">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
    </div>
  );
}

export default function App() {
  const [books, setBooks] = useState(() => loadCatalog().map(bookFromStored));
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveCatalog(books);
  }, [books]);

  useEffect(() => {
    return () => {
      books.forEach((book) => {
        if (book.url) URL.revokeObjectURL(book.url);
      });
    };
  }, [books]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || books[0] || null,
    [books, selectedBookId]
  );

  useEffect(() => {
    if (selectedBook && selectedBook.id !== selectedBookId) {
      setSelectedBookId(selectedBook.id);
    }
  }, [selectedBook, selectedBookId]);

  const sortedSongs = useMemo(() => {
    if (!selectedBook) return [];
    return [...selectedBook.songs].sort((a, b) => a.page - b.page || a.title.localeCompare(b.title));
  }, [selectedBook]);

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
      if (newBooks[0]) {
        setSelectedBookId(newBooks[0].id);
        setCurrentPage(1);
      }
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
      if (newBooks[0]) {
        setSelectedBookId(newBooks[0].id);
        setCurrentPage(1);
      }
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
    setBooks(imported);
    setSelectedBookId(imported[0]?.id || null);
    setCurrentPage(1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Song Book Library</h1>
          <p>
            Load PDF song books, review the detected song index, and tap a song name to jump to its page.
          </p>
        </div>
        <div className="toolbar wrap">
          <button className="primary-btn" onClick={handleAddFolder}>
            Add folder
          </button>
          <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
            Add PDF files
          </button>
          <button className="secondary-btn" onClick={exportCatalog} disabled={!books.length}>
            Export catalog
          </button>
          <label className="secondary-btn file-label">
            Import catalog
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => e.target.files?.[0] && importCatalog(e.target.files[0])}
            />
          </label>
          <button className="ghost-btn danger" onClick={() => setBooks([])} disabled={!books.length}>
            Clear
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
        </div>
      </header>

      <div className="notice-card">
        On Android Chrome and desktop Chromium browsers, <strong>Add folder</strong> can open a local directory. On browsers without folder access,
        use <strong>Add PDF files</strong>. The app can suggest songs from an index page, but you can correct titles and page numbers manually.
      </div>

      <main className="main-grid">
        <section className="panel">
          <div className="panel-header">Books</div>
          <div className="panel-body list-panel">
            {books.length === 0 ? (
              <div className="empty-panel">No books loaded yet.</div>
            ) : (
              books.map((book) => (
                <button
                  key={book.id}
                  className={`list-item ${selectedBook?.id === book.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedBookId(book.id);
                    setCurrentPage(1);
                  }}
                >
                  <span>{book.title}</span>
                  <small>
                    {book.songs.length} songs · {book.pageCount || '?'} pages
                    {book.missingFile ? ' · relink needed' : ''}
                  </small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">Songs in selected book</div>
          <SongEditor
            book={selectedBook}
            onBookChange={updateBook}
            onOpenSong={(page) => setCurrentPage(clampPage(page, selectedBook?.pageCount))}
          />
          {selectedBook ? (
            <div className="song-list-footer">
              <div className="mini-title">Quick song list</div>
              <div className="quick-song-list">
                {sortedSongs.map((song) => (
                  <button
                    key={`${song.id}-quick`}
                    className="quick-song-item"
                    onClick={() => setCurrentPage(clampPage(song.page, selectedBook.pageCount))}
                  >
                    <span>{song.title}</span>
                    <small>p. {song.page}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel viewer-panel">
          <div className="panel-header viewer-controls">
            <span>PDF page</span>
            {selectedBook ? (
              <div className="toolbar">
                <button
                  className="ghost-btn"
                  onClick={() => setCurrentPage((page) => clampPage(page - 1, selectedBook.pageCount))}
                >
                  Prev
                </button>
                <input
                  className="page-input"
                  type="number"
                  min="1"
                  max={selectedBook.pageCount || 1}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(clampPage(e.target.value, selectedBook.pageCount))}
                />
                <button
                  className="ghost-btn"
                  onClick={() => setCurrentPage((page) => clampPage(page + 1, selectedBook.pageCount))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
          <div className="panel-body viewer-body">
            {selectedBook?.missingFile ? (
              <div className="empty-panel">
                This catalog entry was restored without its PDF file. Re-add the PDF from local storage to open pages.
              </div>
            ) : (
              <PdfViewer
                file={selectedBook?.file}
                url={selectedBook?.url}
                pageNumber={currentPage}
                pageCount={selectedBook?.pageCount}
                onPageCount={(count) => {
                  if (selectedBook && count !== selectedBook.pageCount) {
                    updateBook(selectedBook.id, { pageCount: count });
                  }
                }}
                title={selectedBook?.title || 'PDF viewer'}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
