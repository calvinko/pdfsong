import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClientInstance } from './clientInstance.js';

const COLLAPSED_BOOKS_STORAGE_KEY = 'songbook-pwa-manage-collapsed-v1';

function loadCollapsedBooks() {
  try {
    const raw = localStorage.getItem(COLLAPSED_BOOKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCollapsedBooks(collapsedBooks) {
  localStorage.setItem(COLLAPSED_BOOKS_STORAGE_KEY, JSON.stringify(collapsedBooks));
}

function SectionNotice({ panelClass }) {
  return (
    <div className={`${panelClass} mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600`}>
      On Android Chrome and desktop Chromium browsers, <strong>Add folder</strong> can open a local directory. On browsers without
      folder access, use <strong>Add PDF files</strong>. PDFs are cached in IndexedDB after the first import.
    </div>
  );
}

function ImportStatusPane({ status, onDismiss, onImportAnyway, panelClass, panelHeaderClass, panelBodyClass, secondaryButtonClass }) {
  if (!status?.visible) return null;

  const total = Number(status.total) || 0;
  const processed = Number(status.processed) || 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <section className={`${panelClass} mb-4 overflow-hidden`}>
      <div className={panelHeaderClass}>
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-base font-semibold text-slate-900">Import Status</div>
          <button className={secondaryButtonClass} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
      <div className={`${panelBodyClass} flex flex-col gap-3`}>
        <div className="text-sm text-slate-700">{status.message}</div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="text-xs text-slate-500">
          {processed} of {total} processed
        </div>
        {status.currentFile ? <div className="text-sm text-slate-600">Current file: {status.currentFile}</div> : null}
        {Array.isArray(status.items) && status.items.length ? (
          <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {status.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-slate-700">{item.name}</div>
                  {item.metadata?.internalTitle ? (
                    <div className="truncate text-xs text-slate-500">Internal title: {item.metadata.internalTitle}</div>
                  ) : null}
                  {item.metadata?.pageCount || item.metadata?.songCount ? (
                    <div className="text-xs text-slate-500">
                      {item.metadata?.pageCount ? `${item.metadata.pageCount} pages` : ''}
                      {item.metadata?.pageCount && item.metadata?.songCount ? ' · ' : ''}
                      {item.metadata?.songCount ? `${item.metadata.songCount} songs` : ''}
                    </div>
                  ) : null}
                  {item.metadata?.reason ? (
                    <div className="text-xs text-slate-500">{item.metadata.reason}</div>
                  ) : null}
                </div>
                <span
                  className={
                    item.state === 'error'
                      ? 'shrink-0 text-rose-600'
                      : item.state === 'skipped'
                        ? 'shrink-0 text-amber-600'
                        : 'shrink-0 text-slate-500'
                  }
                >
                  {item.state}
                </span>
                {item.state === 'skipped' && item.file ? (
                  <button
                    className={`${secondaryButtonClass} shrink-0 px-3 py-1 text-xs`}
                    onClick={() => onImportAnyway(item)}
                  >
                    Import anyway
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BookSongEditor({
  book,
  updateBook,
  inputClass,
  pageInputClass,
  dangerGhostButtonClass,
  primaryButtonClass,
  emptyPanelClass,
  clampPage,
}) {
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

function BookSongIndexList({ book, emptyPanelClass }) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      {book.songs.length === 0 ? (
        <div className={emptyPanelClass}>No songs found in the index yet.</div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-200">
          {book.songs
            .slice()
            .sort((a, b) => a.page - b.page || a.title.localeCompare(b.title))
            .map((song) => (
              <div key={song.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-900">{song.title}</span>
                <span className="shrink-0 text-xs text-slate-500">p. {song.page}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AuthOverlay({
  authSession,
  authMode,
  authForm,
  authError,
  authSuccess,
  authSubmitting,
  backupSubmitting,
  backupStatus,
  canBackup,
  inputClass,
  primaryButtonClass,
  dangerGhostButtonClass,
  secondaryButtonClass,
  onClose,
  onLogout,
  onBackup,
  onAuthModeChange,
  onAuthFormChange,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">
              {authSession ? 'Account' : authMode === 'register' ? 'Create account' : 'Log in'}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {authSession ? 'Manage your current session and server backups.' : 'Register or log in from the app.'}
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close login dialog"
            title="Close"
            type="button"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {authSession ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {authSession.user?.email || 'Signed in'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {authSession.user?.userUuid ? `User ID: ${authSession.user.userUuid}` : 'Session active'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Server backup</div>
                <div className="mt-1 text-sm text-slate-500">
                  Upload all available book PDFs and song catalogs to your account.
                </div>
                <button
                  className={`${primaryButtonClass} mt-3 w-full`}
                  onClick={onBackup}
                  type="button"
                  disabled={!canBackup || backupSubmitting}
                >
                  {backupSubmitting ? 'Backing up...' : 'Back up all books'}
                </button>
                {backupStatus ? (
                  <div
                    className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                      backupStatus.tone === 'error'
                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {backupStatus.message}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <button className={secondaryButtonClass} onClick={onClose} type="button">
                  Close
                </button>
                <button className={dangerGhostButtonClass} onClick={onLogout} type="button">
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  onClick={() => onAuthModeChange('login')}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  onClick={() => onAuthModeChange('register')}
                  type="button"
                >
                  Register
                </button>
              </div>

              <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                {authMode === 'register' ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Display name</label>
                    <input
                      className={inputClass}
                      value={authForm.displayName}
                      onChange={(e) => onAuthFormChange('displayName', e.target.value)}
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
                    onChange={(e) => onAuthFormChange('email', e.target.value)}
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
                    onChange={(e) => onAuthFormChange('password', e.target.value)}
                    placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'}
                    required
                  />
                </div>

                {authError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</div> : null}
                {authSuccess ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authSuccess}</div> : null}

                <div className="flex justify-end gap-2">
                  <button className={secondaryButtonClass} onClick={onClose} type="button">
                    Close
                  </button>
                  <button className={primaryButtonClass} type="submit" disabled={authSubmitting}>
                    {authSubmitting ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Log in'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmClearOverlay({ bookCount, dangerGhostButtonClass, secondaryButtonClass, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Clear library?</div>
          <div className="mt-1 text-sm text-slate-500">
            This removes {bookCount} book{bookCount === 1 ? '' : 's'} from your device and clears the saved PDFs.
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            This cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <button className={secondaryButtonClass} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={dangerGhostButtonClass} onClick={onConfirm} type="button">
              Clear library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteBookOverlay({ book, dangerGhostButtonClass, secondaryButtonClass, onClose, onConfirm }) {
  if (!book) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Delete book?</div>
          <div className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{book.title}</span> will be removed from your library and its saved PDF will be deleted.
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            This cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <button className={secondaryButtonClass} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={dangerGhostButtonClass} onClick={onConfirm} type="button">
              Delete book
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmRestoreOverlay({
  bookCount,
  songCount,
  fileName,
  dangerGhostButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  onClose,
  onMerge,
  onOverwrite,
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Restore backup?</div>
          <div className="mt-1 text-sm text-slate-500">
            Your library already has {bookCount} book{bookCount === 1 ? '' : 's'} and {songCount} song{songCount === 1 ? '' : 's'}.
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Choose how to restore <span className="font-medium text-slate-800">{fileName || 'this backup file'}</span>.
          </div>
          <div className="flex flex-col justify-end gap-2 sm:flex-row">
            <button className={secondaryButtonClass} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={primaryButtonClass} onClick={onMerge} type="button">
              Merge
            </button>
            <button className={dangerGhostButtonClass} onClick={onOverwrite} type="button">
              Overwrite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagePage({
  books,
  isRestoringFiles,
  authSession,
  clientInstance,
  importStatus,
  fileInputRef,
  restoreInputRef,
  onAddFolder,
  onFilesChosen,
  onBackupSongbooks,
  onBackupSongsData,
  onRestoreSongsData,
  onClear,
  onDeleteBook,
  onReorderBooks,
  onDismissImportStatus,
  onImportAnyway,
  onAuthSuccess,
  onLogout,
  updateBook,
  onAnalyze,
  onGetStatus,
  apiRequest,
  uid,
  clampPage,
  PageFrame,
  styles,
}) {
  const {
    panelClass,
    panelHeaderClass,
    panelBodyClass,
    emptyPanelClass,
    inputClass,
    pageInputClass,
    secondaryButtonClass,
    primaryButtonClass,
    dangerGhostButtonClass,
  } = styles;

  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [collapsedBooks, setCollapsedBooks] = useState(() => loadCollapsedBooks());
  const [editingBooks, setEditingBooks] = useState({});
  const [arrangeMode, setArrangeMode] = useState(false);
  const [draggedBookId, setDraggedBookId] = useState(null);
  const [renamingBookId, setRenamingBookId] = useState(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [bookPendingDelete, setBookPendingDelete] = useState(null);
  const [backupSubmitting, setBackupSubmitting] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [dataFileSubmitting, setDataFileSubmitting] = useState(false);
  const [dataFileStatus, setDataFileStatus] = useState(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);
  const [visibleClientInstance, setVisibleClientInstance] = useState(clientInstance);
  const songCount = books.reduce((total, book) => total + (Array.isArray(book.songs) ? book.songs.length : 0), 0);

  useEffect(() => {
    setCollapsedBooks((current) => {
      const next = {};

      books.forEach((book) => {
        next[book.id] = current[book.id] ?? true;
      });

      return next;
    });
  }, [books]);

  useEffect(() => {
    saveCollapsedBooks(collapsedBooks);
  }, [collapsedBooks]);

  useEffect(() => {
    setVisibleClientInstance(clientInstance || getClientInstance());
  }, [clientInstance]);

  function startRenamingBook(book) {
    setRenamingBookId(book.id);
    setRenamingTitle(book.title || '');
  }

  function finishRenamingBook(book) {
    const nextTitle = renamingTitle.trim();
    if (nextTitle) {
      updateBook(book.id, { title: nextTitle });
    }
    setRenamingBookId(null);
    setRenamingTitle('');
  }

  useEffect(() => {
    setEditingBooks((current) => {
      const next = {};

      books.forEach((book) => {
        next[book.id] = current[book.id] ?? false;
      });

      return next;
    });
  }, [books]);

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
      setShowAuthOverlay(false);
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleBackupClick() {
    setBackupStatus(null);

    if (!authSession) {
      setAuthMode('login');
      setAuthError('');
      setAuthSuccess('Log in or register to back up your songbooks.');
      setShowAuthOverlay(true);
      return;
    }

    setBackupSubmitting(true);

    try {
      const result = await onBackupSongbooks(authSession);
      setBackupStatus({
        tone: 'success',
        message: `Backed up ${result.backedUp} songbook${result.backedUp === 1 ? '' : 's'}${result.skipped ? ` · skipped ${result.skipped} without local PDFs` : ''}.`
      });
    } catch (error) {
      setBackupStatus({
        tone: 'error',
        message: error.message || 'Unable to back up songbooks.'
      });
    } finally {
      setBackupSubmitting(false);
    }
  }

  async function handleBackupSongsDataClick() {
    setDataFileStatus(null);
    setDataFileSubmitting(true);

    try {
      const result = await onBackupSongsData();
      setDataFileStatus({
        tone: 'success',
        message: `${result.saveMethod === 'chosen-location' ? 'Saved backup file' : 'Downloaded backup file'} with ${result.backedUp} PDF${result.backedUp === 1 ? '' : 's'}${result.missing ? ` · ${result.missing} missing PDF${result.missing === 1 ? '' : 's'} included as catalog only` : ''}.`
      });
    } catch (error) {
      setDataFileStatus({
        tone: 'error',
        message: error.message || 'Unable to create backup file.'
      });
    } finally {
      setDataFileSubmitting(false);
    }
  }

  async function handleRestoreSongsDataFile(file, restoreMode = 'overwrite') {
    if (!file) return;

    setPendingRestoreFile(null);
    setDataFileStatus(null);
    setDataFileSubmitting(true);

    try {
      const result = await onRestoreSongsData(file, restoreMode);
      const action = result.mode === 'merge' ? 'Merged' : 'Restored';
      setDataFileStatus({
        tone: 'success',
        message: `${action} ${result.restored} book${result.restored === 1 ? '' : 's'}${result.missing ? ` · ${result.missing} missing PDF${result.missing === 1 ? '' : 's'} restored as catalog only` : ''}.`
      });
    } catch (error) {
      setDataFileStatus({
        tone: 'error',
        message: error.message || 'Unable to restore backup file.'
      });
    } finally {
      setDataFileSubmitting(false);
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  }

  function handleRestoreInputChange(file) {
    if (!file) return;

    if (books.length > 0 || songCount > 0) {
      setPendingRestoreFile(file);
      return;
    }

    handleRestoreSongsDataFile(file);
  }

  return (
    <div className="flex flex-col gap-4">
      {showAuthOverlay ? (
        <AuthOverlay
          authSession={authSession}
          authMode={authMode}
          authForm={authForm}
          authError={authError}
          authSuccess={authSuccess}
          authSubmitting={authSubmitting}
          inputClass={inputClass}
          primaryButtonClass={primaryButtonClass}
          dangerGhostButtonClass={dangerGhostButtonClass}
          secondaryButtonClass={secondaryButtonClass}
          onClose={() => {
            setShowAuthOverlay(false);
            setAuthError('');
            setAuthSuccess('');
          }}
          onLogout={() => {
            onLogout();
            setShowAuthOverlay(false);
          }}
          backupSubmitting={backupSubmitting}
          backupStatus={backupStatus}
          canBackup={books.length > 0}
          onBackup={handleBackupClick}
          onAuthModeChange={(mode) => {
            setAuthMode(mode);
            setAuthError('');
            setAuthSuccess('');
          }}
          onAuthFormChange={(field, value) => setAuthForm((current) => ({ ...current, [field]: value }))}
          onSubmit={handleAuthSubmit}
        />
      ) : null}

      {showClearConfirm ? (
        <ConfirmClearOverlay
          bookCount={books.length}
          dangerGhostButtonClass={dangerGhostButtonClass}
          secondaryButtonClass={secondaryButtonClass}
          onClose={() => setShowClearConfirm(false)}
          onConfirm={() => {
            setShowClearConfirm(false);
            onClear();
          }}
        />
      ) : null}

      {bookPendingDelete ? (
        <ConfirmDeleteBookOverlay
          book={bookPendingDelete}
          dangerGhostButtonClass={dangerGhostButtonClass}
          secondaryButtonClass={secondaryButtonClass}
          onClose={() => setBookPendingDelete(null)}
          onConfirm={() => {
            const book = bookPendingDelete;
            setBookPendingDelete(null);
            onDeleteBook(book, { navigateAfterDelete: false });
          }}
        />
      ) : null}

      {pendingRestoreFile ? (
        <ConfirmRestoreOverlay
          bookCount={books.length}
          songCount={songCount}
          fileName={pendingRestoreFile.name}
          dangerGhostButtonClass={dangerGhostButtonClass}
          primaryButtonClass={primaryButtonClass}
          secondaryButtonClass={secondaryButtonClass}
          onClose={() => {
            setPendingRestoreFile(null);
            if (restoreInputRef.current) {
              restoreInputRef.current.value = '';
            }
          }}
          onMerge={() => handleRestoreSongsDataFile(pendingRestoreFile, 'merge')}
          onOverwrite={() => handleRestoreSongsDataFile(pendingRestoreFile, 'overwrite')}
        />
      ) : null}

      <ImportStatusPane
        status={importStatus}
        onDismiss={onDismissImportStatus}
        onImportAnyway={onImportAnyway}
        panelClass={panelClass}
        panelHeaderClass={panelHeaderClass}
        panelBodyClass={panelBodyClass}
        secondaryButtonClass={secondaryButtonClass}
      />

      <SectionNotice panelClass={panelClass} />

      <PageFrame
        title="Manage Library"
        subtitle="Import, back up, add books, and add songs from one place"
        headerAction={
          <button
            className={secondaryButtonClass}
            onClick={() => {
              setShowAuthOverlay(true);
              setAuthError('');
              setAuthSuccess('');
            }}
            type="button"
            title={!authSession ? 'Login to backup your song books and catalog.' : authSession.user?.email || 'Logged in'}
          >
            {authSession?.user?.email ? `Logged in: ${authSession.user.email}` : 'Login'}
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className={primaryButtonClass} onClick={onAddFolder}>
            Import from Folder
          </button>
          <button className={secondaryButtonClass} onClick={() => fileInputRef.current?.click()}>
            Import Songbooks
          </button>
          <button
            className={secondaryButtonClass}
            onClick={handleBackupSongsDataClick}
            disabled={!books.length || dataFileSubmitting}
          >
            {dataFileSubmitting ? 'Preparing...' : 'Backup Song Books'}
          </button>
          <button
            className={secondaryButtonClass}
            onClick={() => restoreInputRef.current?.click()}
            disabled={dataFileSubmitting}
          >
            Restore Song Books
          </button>
          <button
            className={`${dangerGhostButtonClass} sm:col-span-2`}
            onClick={() => setShowClearConfirm(true)}
            disabled={!books.length}
          >
            Clear library
          </button>
        </div>

        {dataFileStatus ? (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              dataFileStatus.tone === 'error'
                ? 'border border-rose-200 bg-rose-50 text-rose-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {dataFileStatus.message}
          </div>
        ) : null}

        {visibleClientInstance?.deviceInfo ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">This device</div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-2">
              <div>Instance ID: {visibleClientInstance.instanceId}</div>
              <div>Type: {visibleClientInstance.deviceInfo.deviceType}</div>
              <div>Machine: {visibleClientInstance.deviceInfo.machine}</div>
              <div>OS: {visibleClientInstance.deviceInfo.operatingSystem}</div>
              <div>Browser: {visibleClientInstance.deviceInfo.browser}</div>
              <div>Touch: {visibleClientInstance.deviceInfo.touch}</div>
              <div>Screen: {visibleClientInstance.deviceInfo.screen}</div>
            </div>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => handleRestoreInputChange(e.target.files?.[0])}
        />
      </PageFrame>

      <PageFrame
        title="Books"
        subtitle="Add a song directly into any book"
        headerAction={
          books.length ? (
            <div className="flex items-center gap-2">
              <button
                className={secondaryButtonClass}
                onClick={() => setArrangeMode((current) => !current)}
              >
                {arrangeMode ? 'Done arranging' : 'Arrange'}
              </button>
              <button
                className={secondaryButtonClass}
                onClick={() =>
                  setCollapsedBooks(
                    books.reduce((next, book) => {
                      next[book.id] = true;
                      return next;
                    }, {})
                  )
                }
              >
                Collapse all
              </button>
            </div>
          ) : null
        }
      >
        {isRestoringFiles ? (
          <div className={emptyPanelClass}>Restoring saved PDFs…</div>
        ) : books.length === 0 ? (
          <div className={emptyPanelClass}>No books loaded yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {books.map((book) => (
              <div
                key={book.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  arrangeMode && draggedBookId === book.id
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
                draggable={arrangeMode}
                onDragStart={() => setDraggedBookId(book.id)}
                onDragEnd={() => setDraggedBookId(null)}
                onDragOver={(event) => {
                  if (!arrangeMode || draggedBookId === null || draggedBookId === book.id) return;
                  event.preventDefault();
                }}
                onDrop={() => {
                  if (!arrangeMode || draggedBookId === null || draggedBookId === book.id) return;
                  onReorderBooks(draggedBookId, book.id);
                  setDraggedBookId(draggedBookId);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {renamingBookId === book.id ? (
                        <input
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          value={renamingTitle}
                          onChange={(e) => setRenamingTitle(e.target.value)}
                          onBlur={() => finishRenamingBook(book)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRenamingBook(book);
                            if (e.key === 'Escape') {
                              setRenamingBookId(null);
                              setRenamingTitle('');
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-slate-900">{book.title}</div>
                          <button
                            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 transition hover:bg-white hover:text-slate-700"
                            onClick={() => startRenamingBook(book)}
                            aria-label={`Edit ${book.title} name`}
                            title="Edit book name"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {book.songs.length} songs · {book.pageCount || '?'} pages
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {arrangeMode ? (
                      <div
                        className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-500"
                        title="Drag to reorder"
                      >
                        ≡
                      </div>
                    ) : null}
                    {!book.missingFile && book.url ? (
                      <a
                        className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        href={book.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open PDF
                      </a>
                    ) : null}
                    <button
                      className="inline-flex h-6 items-center justify-center rounded-md border border-rose-300 bg-white px-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                      onClick={() => setBookPendingDelete(book)}
                    >
                      Delete
                    </button>
                    <button
                      className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      onClick={() =>
                        setEditingBooks((current) => ({
                          ...current,
                          [book.id]: !current[book.id]
                        }))
                      }
                    >
                      {editingBooks[book.id] ? 'Done' : 'Edit'}
                    </button>
                    <button
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={() =>
                        setCollapsedBooks((current) => ({
                          ...current,
                          [book.id]: !current[book.id]
                        }))
                      }
                      aria-label={collapsedBooks[book.id] ? `Expand ${book.title}` : `Collapse ${book.title}`}
                      title={collapsedBooks[book.id] ? 'Expand' : 'Collapse'}
                    >
                      {collapsedBooks[book.id] ? '▸' : '▾'}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {editingBooks[book.id] ? (
                    <>
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
                    </>
                  ) : null}
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
                {collapsedBooks[book.id]
                  ? null
                  : editingBooks[book.id]
                    ? (
                      <BookSongEditor
                        book={book}
                        updateBook={updateBook}
                        inputClass={inputClass}
                        pageInputClass={pageInputClass}
                        dangerGhostButtonClass={dangerGhostButtonClass}
                        primaryButtonClass={primaryButtonClass}
                        emptyPanelClass={emptyPanelClass}
                        clampPage={clampPage}
                      />
                    )
                    : <BookSongIndexList book={book} emptyPanelClass={emptyPanelClass} />}
              </div>
            ))}
          </div>
        )}
      </PageFrame>
    </div>
  );
}
