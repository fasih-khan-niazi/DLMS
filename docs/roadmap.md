# Two-Week Roadmap

## Week 1

### Phase 1: Foundation

- Repository and monorepo setup
- Root documentation and secret management
- Express API bootstrap
- Expo mobile bootstrap
- Shared types package bootstrap
- Firebase baseline configuration

### Phase 2: Catalog and Search ✅

- ISBN metadata ingestion via Google Books
- Manual metadata fallback
- Book and copy schema setup (`catalog`, `bookCopies`)
- QR payload strategy (`copyId_isbn`)
- Student catalog browse and search
- Librarian/admin add-book flow on mobile

### Phase 3: Borrow and Return ✅

- QR scan flow (borrow / return modes)
- Borrow transaction rules (limit, unpaid fine block, copy status)
- Return transaction rules + fine calculation
- Due date calculation with Sunday/holiday roll-forward
- My Loans screen
- Device access foundation docs + LAN API config

### Phase 4: Reservations ✅

- Student reservation creation (FIFO queue per ISBN)
- Queue processing on return (72-hour hold)
- Ready-for-pickup claim via QR borrow
- 6-hour expiry cron for ready holds
- Mobile Reservations page + Reserve button on book detail

## Week 2

### Phase 5: Digital Library ✅

- Local PDF storage on Express (`api/uploads/`) — Spark workaround (no Firebase Storage)
- Digital book upload/list/stream APIs
- Bookshelf with progress (0-100%) and rating (1-5)
- Mobile E-Library, PDF download/open, Bookshelf, Upload PDF (staff)

### Phase 6: Notifications and Jobs ✅

- FCM / Expo push token registration
- Daily due reminders (T-2, T-1) and overdue alerts
- Reservation-ready push (with in-app notification records)
- Manual cron endpoints for testing (`/internal/cron/...`)
- Reservation expiry cron already active (every 6 hours)

### Phase 6b: Supabase Storage (planned)

Migrate digital PDF files off the API PC disk onto **Supabase Storage**:

- Create free Supabase project + private bucket
- Wire Express upload/stream to Supabase (same `/api/digital-books` routes)
- Keep Firestore metadata; drop reliance on `api/uploads/` for demos
- Update `docs/digital-library.md` and env examples

Do this **before or right at the start of Phase 7** so admin upload also targets cloud storage.

### Phase 7: Admin Web

- Dashboard
- User and role management
- Config management
- Reservation and fine management

### Phase 8: Reporting, Navigation Polish, and Hardening

- Bottom tab navbar (Home, Catalog, Scan, Loans/Activity, Profile)
- Dedicated screens wired into tabs (not only stack buttons)
- Daily metrics
- Date-range reports
- CSV/Excel export
- PDF export
- Security review and polish
