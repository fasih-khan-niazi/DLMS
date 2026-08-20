# Digital Library (Phase 5)

## Storage approach

Firebase Storage requires Blaze on this project. **Today** PDFs live on the
**self-hosted API machine**:

- Folder: `api/uploads/digital-books/`
- Metadata: Firestore `digitalBooks/{id}`
- Bookshelf: `users/{uid}/bookshelf/{digitalBookId}`

**Planned (Phase 6b):** move file bytes to **Supabase Storage** so PDFs are not
tied to the PC disk. API routes stay the same; only the storage backend changes.

## Limits

- PDF only
- Max **25MB** per file
- Files are ignored by git (see root `.gitignore`)

## API

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/digital-books` | any logged-in user |
| GET | `/api/digital-books/:id` | any logged-in user |
| GET | `/api/digital-books/:id/file` | authenticated stream/download |
| POST | `/api/digital-books` (multipart `file`) | librarian/admin |
| DELETE | `/api/digital-books/:id` | unpublish |
| GET | `/api/digital-books/bookshelf/mine` | student |
| POST/PATCH/DELETE | `/api/digital-books/:id/bookshelf` | student |

## Mobile

- **E-Library** - browse/search digital books
- **Upload PDF** - staff only
- **Bookshelf** - progress + star rating
- Open PDF downloads via authenticated API, then device share sheet

## Demo note

PDFs live on your PC. The phone must reach the API (`192.168.100.7:5000`).
If the PC is off, digital books cannot be downloaded.
