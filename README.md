# Song Book Library PWA

A React + Vite progressive web app for browsing local PDF song books on a phone or tablet.

## What it does

- Load multiple PDF song books from a local folder when the browser supports folder picking.
- Fallback to selecting multiple PDF files manually on browsers that do not expose folder access.
- Detect likely song titles and page numbers from the first few pages of each PDF.
- Let the user edit the detected song list.
- Tap a song title to jump to the song page inside the PDF.
- Install as a PWA for a home-screen experience.
- Export and import the song catalog as JSON.

## Important browser notes

- A web app cannot freely read an arbitrary phone directory path by itself. The user must choose a folder or files through the browser picker.
- `showDirectoryPicker()` is supported mainly in Chromium-based browsers. It is not broadly supported in Safari/iPhone browsers.
- On unsupported browsers, the app still works with the **Add PDF files** button.
- The app stores the catalog metadata locally, but the PDFs themselves usually need to be selected again after a full restart.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Good next upgrades

- Persist file handles with IndexedDB on supported browsers.
- Save rendered page thumbnails.
- Add full-text search for song titles and lyrics snippets.
- Add manual page bookmarks and recent songs.
- Add OCR for scanned indexes when the PDF text layer is missing.
