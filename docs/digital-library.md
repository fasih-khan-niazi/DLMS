# Digital Library (Phase 5 + 6b)

## Storage approach

PDF **bytes** are stored in **Supabase Storage** (private bucket `digital-books`).
**Metadata** stays in Firestore:

- Firestore: `digitalBooks/{id}`
- Bookshelf: `users/{uid}/bookshelf/{digitalBookId}`
- Object path example: `digital-books/{ebookId}_{name}.pdf`

See [`supabase.md`](./supabase.md) for project/bucket setup.

Legacy uploads with `storageBackend: "local"` may still exist under
`api/uploads/digital-books/` until re-uploaded.

## Limits

- PDF only
- Max **25MB** per file
- Local upload folder is gitignored; cloud objects are not in git

## API

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/digital-books` | any logged-in user |
| GET | `/api/digital-books/:id` | any logged-in user |
| GET | `/api/digital-books/:id/file` | authenticated stream/download |
| POST | `/api/digital-books` (multipart `file`) | librarian/admin |
| DELETE | `/api/digital-books/:id` | unpublish (+ remove from Supabase) |
| GET | `/api/digital-books/bookshelf/mine` | student |
| POST/PATCH/DELETE | `/api/digital-books/:id/bookshelf` | student |

## Mobile

- **E-Library** - browse/search digital books
- **Upload PDF** - staff only
- **Bookshelf** - progress + star rating
- Open PDF downloads via authenticated API, then device share sheet

## Demo note

API must be running (auth + proxy). PDF files themselves live in Supabase, so they
are not lost when the PC is off - but the phone still needs the API for access control.
