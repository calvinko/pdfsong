from pypdf import PdfReader, PdfWriter

INPUT_PDF = "SongsOfMyHeart-1-2018.pdf"
OUTPUT_PDF = "SongsOfMyHeart-1-2018_bookmarked.pdf"

# Verified from the PDF:
# printed book page 5 appears on PDF page 4 (1-based),
# so pypdf's 0-based page index = printed book page - 2.
def pdf_index_from_book_page(book_page: int) -> int:
    return book_page - 2

songs = [
    (1, "The Awesome Deed of the Trinity", 5),
    (2, "Heavenly Gate is Open", 7),
    (3, "Love Till the End", 8),
    (4, "The Lord’s Love Dream", 10),
    (5, "The Manifold Love of the True Beloved", 12),
    (6, "Until Today You’re Pursuing Me", 14),
    (7, "Your Scar of Love, Forever Riven Deep for Me", 16),
    (8, "I’m His Ultimate Love Secret", 20),
    (9, "The Infinite Lord Enters Into Our Life", 23),
    (10, "The Most Stunning Love Union", 26),
    (11, "The Infinite One Loves Me; I am His Love Dream", 29),
    (12, "A Very Flame of Yahweh", 30),
]

reader = PdfReader(INPUT_PDF)
writer = PdfWriter()

# Copy pages only, so old bookmarks are not carried over.
for page in reader.pages:
    writer.add_page(page)

# Preserve metadata where possible.
if reader.metadata:
    meta = {k: str(v) for k, v in reader.metadata.items() if v is not None}
    if meta:
        writer.add_metadata(meta)

# Add a clearer title.
writer.add_metadata({"/Title": "Songs of My Heart 1 (2018) - Flat Song Index"})

# Add one flat bookmark list.
for no, title, book_page in songs:
    page_index = pdf_index_from_book_page(book_page)
    if not (0 <= page_index < len(reader.pages)):
        raise ValueError(
            f"Bookmark page out of range for #{no} {title!r}: "
            f"book_page={book_page}, page_index={page_index}, total_pages={len(reader.pages)}"
        )
    writer.add_outline_item(f"{no}. {title}", page_number=page_index)

with open(OUTPUT_PDF, "wb") as f:
    writer.write(f)

print(f"Done: {OUTPUT_PDF}")
print(f"Pages: {len(reader.pages)}")
print(f"Bookmarks added: {len(songs)}")
