# Supabase Storage (Phase 6b)

Digital PDF bytes live in **Supabase Storage**. Firestore still stores metadata
(`digitalBooks/{id}`). The Express API uploads/downloads with the **service role**
key so the phone never talks to Supabase directly.

## One-time setup (you do this in the browser)

1. Create a free project at [https://supabase.com](https://supabase.com)
2. Open **Project Settings → API**
   - **Project URL** looks like `https://YOUR_PROJECT_REF.supabase.co`
     (if the UI only shows Project ID / ref, the URL is always
     `https://<project-ref>.supabase.co`)
   - Copy **service_role** JWT (`eyJ...`) → `SUPABASE_SERVICE_ROLE_KEY`
   - You do **not** need the publishable / `sb_publishable_...` key for this API
   - You do **not** need the new `sb_secret_...` key either if you have `service_role`
3. Open **Storage → New bucket**
   - Name: `digital-books` (must match `SUPABASE_DIGITAL_BOOKS_BUCKET`)
   - **Private** (not public)
4. Put values in `api/.env` (never commit):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DIGITAL_BOOKS_BUCKET=digital-books
```

5. Restart the API (`cd api` → `npm run dev`)

No Storage RLS policies are required for the service role. Keep the bucket private;
downloads still go through `GET /api/digital-books/:id/file` with Firebase auth.

## How it works

| Step | What happens |
|------|----------------|
| Upload | Multer keeps PDF in memory → API uploads to bucket path `digital-books/...` |
| Metadata | Firestore doc with `storageBackend: "supabase"` + `storagePath` |
| Download | Mobile hits our API → API downloads from Supabase → streams PDF |
| Unpublish | Soft-delete in Firestore + best-effort remove object from bucket |

Legacy books with `storageBackend: "local"` still stream from `api/uploads/` if the file exists.

## Limits

- PDF only, max **25MB** (same as before)
- Free tier storage is enough for FYP demos; watch the Supabase dashboard quota

## Verify

1. API running with env set
2. Librarian/admin: Upload PDF in the app
3. Student: open/download the book
4. In Supabase → Storage → `digital-books` you should see the file
