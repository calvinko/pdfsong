from pypdf import PdfReader, PdfWriter

INPUT_PDF = "SOL2.pdf"
OUTPUT_PDF = "SOL2_bookmarked.pdf"

# The printed song page numbers in this book map to PDF pages with a +10 offset
# in 1-based numbering, which is +9 in 0-based page indices used by pypdf.
PDF_PAGE_INDEX_OFFSET = 9

songs = [
    (1, 'Love Journey of the Lord—from Infant to Adult', 2),
    (2, 'Take up the Task', 3),
    (3, 'Lord, I Surrender All', 5),
    (4, 'Mountain of Myrrh, Hill of Frankincense', 7),
    (5, 'My Eyes of Faith Behold', 9),
    (6, 'Yesterday, Today, Forever', 11),
    (7, 'The Bright Morning Star', 12),
    (8, 'Amazing Grace', 14),
    (9, 'I am Really Rich', 16),
    (10, 'Gain Christ', 18),
    (11, 'Christ is My Life (Col. 3:1-4)', 20),
    (12, 'What Manner of Love (1 John 3:1-3)', 21),
    (13, 'The Thrill in the Love of the Cross', 22),
    (14, 'Sit in Heaven with the Lord', 24),
    (15, 'His Unforgettable Appearing', 26),
    (16, 'Strive Till He Comes', 29),
    (17, 'He is the God Who Gives Me Hope', 31),
    (18, 'Smile for the Lord', 33),
    (19, 'A Life of Praise', 35),
    (20, 'Enjoy the Lord (Song 5:9-6:1)', 36),
    (21, 'One Sacrifice for Sin Forever (Heb. 10:12-15, 17)', 39),
    (22, 'The Great Love of the Father', 40),
    (23, 'Your Grace Makes Me Strong and Brave', 41),
    (24, 'Press on Towards the Goal', 43),
    (25, 'My All-knowing Friend', 45),
    (26, 'The Beauty of Heaven', 46),
    (27, 'My Father is Infinitely Great', 47),
    (28, 'Lean on the Father’s Bosom', 49),
    (29, 'The Comforter has Come', 50),
    (30, 'Bitter Love Journey', 52),
    (31, 'Love Never Fails', 54),
    (32, 'Two Places Far Apart', 55),
    (33, 'Taste the Perfect Fruit of the Cross', 56),
    (34, 'Lift up Your Head and Rejoice', 58),
    (35, 'Resting Place of My Heart', 59),
    (36, 'My Life Response', 61),
    (37, 'Press on to the Finish Line', 63),
    (38, 'The Lord’s Commission in 1964', 64),
    (39, 'The Worlds of Love', 65),
    (40, 'The Lord’s Sorrow and His Beloved in the Garden', 66),
    (41, 'The Blood of the Lamb—Foundation of Victory (Rev. 12:11)', 68),
    (42, 'If the Lord Comes Today', 69),
    (43, 'The Day That You Will Crown Me', 71),
    (44, 'Wing to the Air', 73),
    (45, 'Unreserved Love (Rom.8:32)', 75),
    (46, 'Enjoy the Lord', 76),
    (47, 'My Eyes of Faith See His Heart', 78),
    (48, 'The Road of Faith', 79),
    (49, 'Take up the Task and Sojourn for the Lord', 81),
    (50, 'Alone with the Father', 83),
    (51, 'I was Created for the Lord', 85),
    (52, 'My Lord in Heaven', 87),
    (53, 'I Affect You Most. You Need Me Most', 90),
    (54, 'Unshakable Foundation', 92),
    (55, 'The Longing of Love', 93),
    (56, 'I Will Love You, Not be Shy', 95),
    (57, 'You Will Surely Give Me the Best', 97),
    (58, 'This is the Day That the Lord Has Made', 100),
    (59, 'Father, ‘Twas Your Love That Knew Us', 101),
    (60, 'Gaze of Love, Ever-Active Thoughts', 103),
    (61, 'The Father’s Longing', 104),
    (62, 'Joined to the Lord', 105),
    (63, 'The Lord’s Love Dream; His Gaze of Love', 107),
    (64, 'Walk in Love with the Lord', 108),
    (65, 'You are the Conclusion of My Dreams', 109),
    (66, 'Walk with Me', 111),
    (67, 'The Scene of Revival (Isa. 32:15)', 113),
    (68, 'My Precious Companion', 114),
    (69, 'The Blood of the Lamb', 115),
    (70, 'The Fruit of the Cross', 116),
    (71, 'The Banner of the Lamb Flies Over Me', 117),
    (72, 'His Blood-sealed Love', 119),
    (73, 'And Can It be That I Should Gain', 120),
    (74, 'Crown Him with Many Crowns', 122),
    (75, 'Jesus, the Very Thought of Thee', 124),
    (76, 'Lord Jesus! When We Think of Thee', 126),
    (77, 'I am Content', 128),
    (78, 'God’s Unique, Memorable Name (Exo. 3:14-15, Rev. 1:8, 1 John 5:20-21, 2:13-14)', 129),
    (79, 'The Wonderful Eternal Dance of Love', 130),
    (80, 'Dearest Abba, How Great You are!', 131),
    (81, 'Abba’s Personal Love for Me', 133),
    (82, 'Fearfully Made and Born Again', 135),
    (83, 'Glorious Miracle of Love', 136),
    (84, 'The Father’s Tender Care', 137),
    (85, 'I Exist Because of Abba', 138),
    (86, 'The Tender Love and Footsteps of the Lamb', 139),
    (87, 'He Came and Died for Me, Now Lives in Me', 140),
    (88, 'The Lord’s Love Dream, His Joy Ahead', 142),
    (89, 'When I Consider Your Love', 144),
    (90, 'The Lamb of God Loved Me and Humbled Himself', 146),
    (91, 'You Betrothed Me with Your Blood', 148),
    (92, 'Stunning Personal Love', 149),
    (93, 'YAH, the Infinite One’s Heart is Reserved for Me', 151),
    (94, 'The Flame of Love of Jehovah', 153),
    (95, 'A World of Two', 155),
    (96, 'The Lord Desires and Admires Me (Song 1-8)', 156),
    (97, 'He Desires Me and Delights in Me the Most', 162),
    (98, 'By You the Best is Now', 164),
    (99, 'He Chose Me. He Loves Me.', 165),
    (100, 'The Glorious Hope', 166),
    (101, 'Same with Me in All Things', 167),
    (102, 'His Zealous Heart to Me', 169),
    (103, 'The Yearning of Love', 171),
    (104, 'Your Choice. Your Love', 172),
    (105, 'Gladly Sit in Heaven with the Lord', 174),
    (106, 'Heart to Heart', 175),
    (107, 'Our Three Stages—Take up the Task, Finish His Will', 177),
    (108, 'March Forward to a Glorious Journey', 182),
    (109, 'The Day the Lord Will Crown Me', 185),
    (110, 'Face to Face', 187),
    (111, 'I am Your Sweet Love Dream', 188),
    (112, 'You Made the Impossible Possible', 190),
    (113, 'Flaming Love of the Cross', 194),
    (114, 'How the Father Felt When He Swore the Oath', 195),
    (115, 'Many Mountains', 197),
    (116, 'The Most Beautiful Love Dream', 199),
    (117, 'The Love That Stuns My Heart', 201),
    (118, 'I am for You; Your Heart is Reserved for Me', 204),
    (119, 'The Glorious Lord of Life', 207),
    (120, 'May You See the Good of the Church All Your Life', 211),
    (121, 'I Trust! I Hope! I Love!', 213),
    (122, 'Come to Me!', 214),
    (123, 'The Beautiful Reasons to Smile', 215),
    (124, 'Smile for the Lord’s Personal Love and Commission', 216),
]

reader = PdfReader(INPUT_PDF)
writer = PdfWriter()

# Copy pages into a fresh writer so old outline/bookmark structures are not kept.
for page in reader.pages:
    writer.add_page(page)

# Preserve existing metadata when possible.
if reader.metadata:
    clean_meta = {k: str(v) for k, v in reader.metadata.items() if v is not None}
    if clean_meta:
        writer.add_metadata(clean_meta)

# Optional: set a clearer title if metadata exists or can be added.
try:
    writer.add_metadata({"/Title": "Collection of Translated Hymns - Flat Song Index"})
except Exception:
    pass

# Add one flat bookmark list.
for number, title, song_page in songs:
    page_index = song_page + PDF_PAGE_INDEX_OFFSET
    if not (0 <= page_index < len(reader.pages)):
        raise ValueError(
            f"Bookmark page out of range for #{number} {title!r}: "
            f"song_page={song_page}, page_index={page_index}, total_pages={len(reader.pages)}"
        )
    writer.add_outline_item(f"{number}. {title}", page_number=page_index)

with open(OUTPUT_PDF, "wb") as f:
    writer.write(f)

print(f"Done: {OUTPUT_PDF}")
print(f"Pages: {len(reader.pages)}")
print(f"Bookmarks added: {len(songs)}")

