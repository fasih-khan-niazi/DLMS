# Week 2 mobile scope (locked)

Mobile-only uplift on branch `dev`. Admin theme follows mobile later, not the reverse.

## Locked decisions

| # | Item | Decision |
|---|------|----------|
| 1 | Design system | Shared components; remove one-off screen styles |
| 2 | Typography | Professional mobile-first fonts (not admin Fraunces/DM Sans copy) |
| 3 | Cover images | Always show cover or branded placeholder; never broken/error tiles |
| 4 | Motion and feedback | Press states, refresh, haptics on key actions |
| 5 | Dark mode | Full second theme (navy/cream family), not plain black |
| 6 | Dashboard home | Real dashboard; remove link-button home |
| 7 | IA and roles | No "Role:" or API URL on UI; staff features via layout, not labels |
| 8 | Activity hub | Loans / Reservations / History with status and empty states |
| 9 | Catalog browse | Filters, sort, grid/list; **15 items per page** with pagination |
| 10 | Book detail | Hero layout; **no student-facing QR or internal copy IDs** |
| 11 | Scan UX | Full-screen scanner, torch, frame, clear success/error sheets |
| 12 | Scan resilience | Loading, retry, last-scanned history (staff) |
| 13 | E-library | Under **Catalog** as two tabs: Physical + E-books (5 bottom tabs unchanged) |
| 14 | Digital reader | Progress, resume, rating, download/open polish |
| 15 | Profile / settings | Settings hub; photo deferred to later phase |
| 16 | Notifications | Badges, mark read, deep links to relevant screens |
| 17 | Errors and empty | Global retry patterns; skeletons everywhere |
| 18 | Performance | Session cache for catalog/home; snappier revisits |
| 19 | Onboarding | First-run carousel + optional first-visit hints (not only tooltips) |
| 20 | Unified search | Home + Catalog entry; recent searches; ISBN-aware (see below) |

## QR and physical copies (locked model)

### What QR is for
- One QR **per physical copy**, stuck on the book by staff.
- **Scan tab** reads the QR (payload stays internal: `copyId_isbn`).
- **Students never** see raw payload or `cpy_seed_...` in catalog.

### Book detail (student)
- Cover, title, authors, description, availability summary.
- Actions: **Scan to borrow** (opens Scan), **Reserve** if unavailable.
- No per-copy QR grid, no internal copy IDs.

### Book detail / staff tools (librarian)
- **Print label** per copy: QR + human-readable label (title, copy number, ISBN/barcode).
- Share/save as image or PDF for printing (no admin portal required for MVP of this).
- Optional: copy list with status (Available / Issued / Reserved) using friendly labels only.

### Borrow paths
- Primary: Scan QR at shelf.
- Secondary: Ready reservation claim via scan (unchanged backend).
- Remove borrow-from-catalog-copy-list for students (was exposing internal IDs).

## Thumbnails (locked)
- Use `thumbnailUrl` when present.
- On missing URL or `onError`: same **placeholder** component everywhere (neutral book illustration on cream/navy card).
- Never show broken image icon or empty box.

## Pagination (locked)
- **15** results per page in catalog (physical and e-books lists).
- API: add `page` + `pageSize` (or cursor) on catalog/digital list endpoints.
- UI: Previous / Next or numbered pages at bottom.

## Role UX (locked)
- Same app binary; UI adapts from API role.
- **Student:** consumer library experience.
- **Staff:** extra entries (Add book, Upload PDF, Print labels) in Profile and/or contextual actions; no "librarian" badge on home/profile.
- Remove profile lines: Role, API URL.

## Profile photo
- Acknowledged for a **later sub-phase** after core UI ship; not blocking Phase 1.

## Out of scope (Week 2 mobile)
- Admin portal redesign
- New backend features unless required for pagination/search/print labels
- Rebuilding production APK until a mobile milestone is demo-ready on Expo Go

## Git practice (Week 2)
- Work on `dev`; commit in small slices (`feat(mobile): ...`).
- Push `origin/dev` regularly.
- Do **not** merge to `main` until Week 2 client release (keeps Render on Week 1 for live users).

## Next step

Phased implementation plan: [`docs/mobile-week2-plan.md`](mobile-week2-plan.md).
