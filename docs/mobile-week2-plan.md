# Week 2 mobile implementation plan

Phased build for items **1-20** from [`mobile-week2-scope.md`](mobile-week2-scope.md).  
Branch: **`dev` only**. Test with **Expo Go**. Do not merge to **`main`** until Week 2 release.

No em dashes in UI copy.

---

## Principles

1. **Foundation first** so later screens reuse components, not one-off styles.
2. **One phase = one or two shippable commits**; app must run after each phase.
3. **API changes only when UI needs them** (pagination, search metadata).
4. **Regression smoke** after every phase (login, catalog, scan borrow, digital open, activity).
5. **Week 1 live users** share the same DB; avoid destructive test data during demos.

---

## Phase map (overview)

| Phase | Name | Scope items | Risk |
|-------|------|-------------|------|
| 0 | Baseline | — | Low |
| 1 | Design foundation | 1, 2, 3, 5 (light first) | Low |
| 2 | API pagination | 9 (backend) | Medium |
| 3 | Navigation and IA | 7, 13, 6 (shell) | Medium |
| 4 | Catalog and search | 9, 10, 20, 3 | Medium |
| 5 | Home dashboard | 6, 16 (badge), 18 (start) | Low |
| 6 | Activity hub | 8, 17 | Low |
| 7 | Scan experience | 11, 12 | Medium |
| 8 | Staff QR and print | 10 (staff), 7 | Medium |
| 9 | E-books tab and reader | 13, 14 | Medium |
| 10 | Profile and settings | 15, 7, 5 (dark toggle) | Low |
| 11 | Notifications polish | 16 | Low |
| 12 | Onboarding | 19 | Low |
| 13 | Motion, haptics, perf | 4, 17, 18 | Low |
| 14 | Dark theme completion | 5 | Low |
| 15 | QA and Week 2 tag prep | all | Low |

Profile **photo** is explicitly **post-Phase 15** (future sub-phase).

---

## Phase 0: Baseline and safety net

**Status:** Automated checks complete (2026-08-22). Manual Expo Go smoke: see [`mobile-week2-phase0-baseline.md`](mobile-week2-phase0-baseline.md).

**Goal:** Confirm Week 1 flows still work on Render before large UI diffs.

**Tasks**
- [ ] Confirm `dev` checked out; `mobile/.env` points at Render API (or local if you prefer isolated API testing).
- [ ] Expo Go smoke: login student, catalog, book detail, scan borrow/return, e-library list, activity loans, notifications, profile logout.
- [ ] Note any existing bugs in a short list (fix only if blocking Phase 1).

**Git:** No code commit required unless fixes found.  
**Commit message (if fixes):** `fix(mobile): baseline smoke fixes before week2 UI`

---

## Phase 1: Design foundation (1, 2, 3, 5 partial)

**Goal:** Mobile owns the visual language. All new work uses shared primitives.

**Deliverables**
- **Typography (2):** Load mobile-first pair via `expo-font` (e.g. **Plus Jakarta Sans** UI + **Literata** or **Source Serif** for titles; final choice in implementation). Apply via `ThemeProvider`.
- **Theme (1, 5 light):** Extend `theme.ts` into `theme/` with `colors`, `spacing`, `type`, `shadows`. Light theme only in this phase.
- **Components (1):**
  - `Screen` (safe area, scroll, background)
  - `ScreenHeader` (title, back, optional action)
  - `Button` (primary, secondary, ghost, danger)
  - `Input`, `SearchInput`
  - `Card`, `Badge`, `Chip`
  - `BookCover` (3): image + **single branded placeholder** on missing/error
  - `LoadingState`, `ErrorState` with retry (17 starter)
  - `Skeleton` variants aligned to new layout
- Refactor **auth screens** (Login, Register, Forgot) to primitives only (validates system early).

**Files (typical):** `mobile/src/theme/*`, `mobile/src/components/ui/*`, auth screens, `App.tsx` or root `ThemeProvider`.

**Regression:** Auth still works; no behavior change on tabs yet.

**Git:** `feat(mobile): design system, fonts, BookCover placeholder`

---

## Phase 2: API pagination (9 backend)

**Goal:** Catalog and digital lists support **15 items per page**.

**API changes**
- `GET /api/catalog/books?page=1&pageSize=15&q=&sort=&availability=`
  - Response: `{ results, page, pageSize, total, totalPages }`
  - Default `pageSize=15`, max 50
  - Keep search keywords behavior; add optional `sort` (title asc, title desc, newest)
- `GET /api/digital-books?page=1&pageSize=15&q=`
  - Same pagination shape

**Mobile:** Wire in Phase 4/9; API first so UI is not faked.

**Regression:** Existing clients without `page` still work (default page 1, size 15 or 30 during transition).

**Git:** `feat(api): paginated catalog and digital book lists`

---

## Phase 3: Navigation and IA (7, 13, 6 shell)

**Goal:** Five bottom tabs unchanged; Catalog becomes hub; home stops being link buttons.

**Bottom tabs (unchanged count)**
1. Home  
2. Catalog (Physical | E-books inner tabs)  
3. Scan  
4. Activity  
5. Profile  

**Tasks**
- [ ] **Catalog stack:** Top segmented control **Physical books** | **E-books** (13).
- [ ] Move `DigitalLibraryScreen` entry into Catalog e-books tab; remove duplicate deep links from Home button list (6 prep, 7).
- [ ] **Role-aware routing (7):** `useProfile()` hook loads `/api/auth/me` once; `isStaff` drives menus. **No** role label anywhere.
- [ ] **Home (6 shell):** Replace link-button layout with placeholder sections (filled in Phase 5).
- [ ] **Profile:** Remove **Role** and **API URL** lines immediately (7).
- [ ] Consolidate stacks: trim duplicate `Notifications` / `AddBook` / `DigitalLibrary` registrations where possible.

**Regression:** All tabs reachable; staff still sees add/upload entry points (Profile or FAB later).

**Git:** `feat(mobile): catalog physical/ebooks tabs and navigation cleanup`

---

## Phase 4: Catalog, book detail, search (9, 10, 20, 3)

**Goal:** Professional browse and detail; no internal IDs for students.

**Physical catalog (9)**
- [ ] List + **grid toggle**; sort and filter chips (availability, categories if present).
- [ ] **Pagination:** 15 per page, Previous/Next + page indicator.
- [ ] `BookCover` on every row; placeholder on failure (3).
- [ ] Pull-to-refresh + skeletons (17).

**Book detail (10)**
- [ ] Hero: large cover, title, authors, ISBN (formatted), availability summary.
- [ ] Student actions: **Scan to borrow** (navigate Scan tab), **Reserve** when unavailable.
- [ ] **Remove:** per-copy QR images, `cpy_seed_...`, raw `copyId`, borrow-per-copy buttons for students.
- [ ] Description, categories, page count when available.

**Unified search (20)**
- [ ] Shared `SearchBar` on Home (quick) and Catalog (primary).
- [ ] Debounced query to API; detect ISBN-shaped input.
- [ ] **Recent searches** in AsyncStorage (max 8); clear option.
- [ ] Explain in UI: one search for title, author, or ISBN.

**Regression:** Search, paginate, open detail, reserve still works; scan borrow still primary.

**Git:** `feat(mobile): catalog pagination, book detail redesign, unified search`

---

## Phase 5: Home dashboard (6, 16 partial, 18 start)

**Goal:** Home feels like a real app landing screen.

**Sections**
- [ ] Greeting + notification bell with **unread badge** (16).
- [ ] **At a glance:** active loans, overdue warning, unpaid fine flag, reservation ready banner.
- [ ] **Quick actions:** Scan, Search catalog, Continue reading (if digital progress exists).
- [ ] **Continue reading** carousel (e-books with progress > 0).
- [ ] No button list of screen names; no role text.

**Performance (18):** Cache dashboard summary + last catalog page in memory/sessionStorage pattern (AsyncStorage TTL ~2 min).

**Regression:** Tap through each card/action; cold start still acceptable.

**Git:** `feat(mobile): dashboard home with summaries and quick actions`

---

## Phase 6: Activity hub (8, 17)

**Goal:** One place for loans, reservations, history.

**Tasks**
- [ ] Segmented **Loans | Reservations | History** (returned loans).
- [ ] Status chips: Active, Overdue, Ready, Waiting, Expired.
- [ ] Due countdown on active loans ("Due in 3 days" / "Overdue by 2 days").
- [ ] Empty states with CTA (Browse catalog, Scan return).
- [ ] Skeleton + error retry on each segment.

**Regression:** Borrow/return/reserve still reflected after refresh.

**Git:** `feat(mobile): activity hub with loans reservations history`

---

## Phase 7: Scan experience (11, 12)

**Goal:** Scan tab is the primary floor workflow.

**Tasks**
- [ ] Full-screen camera with **frame overlay** and hint text.
- [ ] **Torch** toggle.
- [ ] Parse `copyId_isbn` payload (unchanged).
- [ ] **Mode toggle:** Borrow | Return (or auto-detect with confirmation).
- [ ] **Result sheet:** success (title, due date) or error (plain language).
- [ ] **Haptics** on success/error (4).
- [ ] Loading state while API runs; **Retry** on failure (12).
- [ ] **Staff only:** last 5 scans list (copy label friendly, e.g. "Animal Farm · Copy 2", not raw id).

**Regression:** QR on physical sticker still borrows/returns; reservation claim via scan works.

**Git:** `feat(mobile): full-screen scan UX with result sheets`

---

## Phase 8: Staff QR print labels (10 staff, 7)

**Goal:** Librarians print shelf labels; students never see QR in catalog.

**Tasks**
- [ ] Staff book detail (or **Manage copies** screen): list copies as **Copy 1, Copy 2** with status only.
- [ ] **Print label** action per copy:
  - Renders label view: QR (encodes existing payload), title, ISBN, copy number, optional barcode text.
  - **Share** via `expo-sharing` / save image (PNG) for print.
- [ ] Optional: bulk "Print all labels for this title".
- [ ] No change to backend QR payload format.

**Regression:** Student detail unchanged; staff can generate and share label.

**Git:** `feat(mobile): staff printable QR copy labels`

---

## Phase 9: E-books tab and reader polish (13, 14)

**Status:** Parked / complete enough (2026-08-24). In-app reader + bookshelf-first flow + zoom polish done. Further reader tweaks only if needed later.

**Goal:** E-books tab matches physical catalog quality.

**E-books list**
- [x] Same design language: `BookCover` placeholder, pagination 15, search shared, grid/list.
- [x] Staff upload entry: **Profile only** (catalog "Upload PDF" pill hidden; add physical/digital from Profile).

**Reader / detail (14)**
- [x] Digital detail: cover, metadata, open with progress; bookshelf-first (Add before Read).
- [x] Resume reading; progress; reviews/NPS (see 9c).
- [x] Bookshelf / continue reading aligned with Home.

**Regression:** Upload (staff via Profile), open PDF in reader, progress save, rating/reviews.

**Git:** `feat(mobile): ebooks tab parity and reader polish`

---

## Phase 9b: In-app reader and smart progress (14 extended)

**Status:** Parked (2026-08-24) — vertical + page modes, pinch zoom, landscape settings, quality, pan. Revisit only if new issues appear.

**Goal:** Read PDFs inside the app; progress reflects actual reading, not scroll position.

**Tasks**
- [x] In-app PDF reader (WebView + PDF.js), fetch from API/Supabase
- [x] Vertical scroll + page-by-page modes (reader settings)
- [x] Pinch zoom, orientation lock, page jump, centered nav in page mode
- [x] Smart progress: ~4s dwell per page; saves only when on bookshelf
- [x] Explicit **Add to Bookshelf** (no auto-save on open)
- [x] Shelf filters: Saved / Reading / Unread / Finished
- [x] Home continue reading opens reader with progress

**Regression:** Add to bookshelf → read several pages (4s+ each) → close → progress updates on detail + Reading filter.

**Git:** `feat(mobile): reader modes, bookshelf save, smart progress`

---

## Phase 9c: Digital reviews and NPS (14 extended)

**Status:** Largely done with digital detail work; confirm on device if anything left before Phase 10.

**Goal:** Students rate and recommend books; peers can read reviews (collapsed by default).

**Tasks**
- [x] API: reviews subcollection, aggregate summary, PUT own review (rating + NPS + comment).
- [x] Mobile: review form on digital detail; expandable reviews list.
- [x] Upload screen: themed, config-driven max PDF size, AppModal success/error.

**Regression:** Save review, expand list, other students see name + rating + recommend score.

**Git:** `feat(api): digital book reviews` + `feat(mobile): student reviews and upload polish`

---

## Phase 10: Profile and settings (15, 7, 5 toggle)

**Status:** Implemented (2026-08-24). Dark palette polish continues in Phase 14.

**Goal:** Profile is a settings hub, not a debug screen.

**Tasks**
- [x] Sections: Account (name, email), Library stats (loans, fines), Preferences, Support.
- [x] **Preferences:** Dark mode toggle (persisted), Notifications inbox link, Bookshelf.
- [x] Staff section: Add physical book, Upload PDF, Print shelf labels help.
- [x] Logout, app version.
- [x] **No** role line, **no** API URL.
- [x] **Deferred:** profile photo upload (future sub-phase).

**Regression:** Logout/login; staff tools still reachable; dark mode persists across relaunch.

**Git:** `feat(mobile): profile settings hub and dark mode toggle`

---

## Phase 11: Notifications polish (16)

**Goal:** Notifications feel integrated.

**Tasks**
- [ ] Unread badge on Home bell (if not done in Phase 5) and optional Profile row.
- [ ] Inbox: read/unread styling, **Mark all read**.
- [ ] Tap row: navigate to Activity (loan), Catalog detail (reservation ready), etc. from metadata.
- [ ] Empty and skeleton states.

**Regression:** API mark-read; counts update.

**Git:** `feat(mobile): notification badges and deep links`

---

## Phase 12: Onboarding (19)

**Goal:** First-run training without annoying veterans.

**Tasks**
- [ ] 3-4 slide carousel after first successful login (AsyncStorage flag `onboardingDone`).
- [ ] Topics: Scan to borrow, Return via Scan, Reserve when unavailable, Fines block new loans.
- [ ] Skip + Done; replay from Profile > Help.
- [ ] Optional one-time coach mark on Scan tab first visit (single tooltip, dismiss forever).

**Regression:** Skip works; does not show again unless replay.

**Git:** `feat(mobile): first-run onboarding carousel`

---

## Phase 13: Motion, haptics, global UX (4, 17, 18)

**Goal:** App feels responsive and finished.

**Tasks**
- [ ] Pressable opacity/scale on buttons and cards (4).
- [ ] Pull-to-refresh on Home, Catalog, Activity, Notifications where missing.
- [ ] Haptics: borrow, return, reserve success, scan success.
- [ ] Pass all major screens for **ErrorState + retry** and **skeleton** (17).
- [ ] Expand session cache (18): catalog page, home summary, profile me.

**Regression:** No jank on low-end device; cache invalidates on pull-to-refresh.

**Git:** `feat(mobile): haptics refresh and global error skeleton pass`

---

## Phase 14: Dark theme completion (5)

**Goal:** Dark mode is designed, not inverted gray.

**Tasks**
- [ ] Dark palette: navy-tinted backgrounds (`#1A2834`), cream-muted text, amber accents unchanged.
- [ ] All UI components and screens audited (auth, tabs, modals, scan overlay).
- [ ] StatusBar style per theme.
- [ ] Toggle in Profile persists (AsyncStorage).

**Regression:** Toggle live; no unreadable text; BookCover placeholder works in dark.

**Git:** `feat(mobile): complete dark theme palette`

---

## Phase 15: QA, docs, Week 2 readiness

**Goal:** Stable Week 2 on `dev`; ready for merge/APK when you choose.

**Tasks**
- [ ] Full smoke script (student + staff accounts) on Render API.
- [ ] Update `docs/mobile-week2-scope.md` with "done" notes if anything shifted.
- [ ] Optional: short `docs/mobile-week2-qa.md` checklist.
- [ ] User decision: merge `dev` → `main`, redeploy Render, new EAS APK.

**Git:** `docs: week2 mobile QA checklist` then tag when releasing (e.g. `v2.0.0-week2`).

---

## Cross-phase dependency graph

```text
Phase 0
  → 1 (design) → 3 (nav) → 4 (catalog) → 5 (home)
                    ↓
                  2 (API) ─────────────→ 4, 9
  1 → 7 (scan) → 8 (print labels)
  3 → 9 (ebooks)
  1 → 10, 11, 12, 13, 14
```

Recommended order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15**

Phases 11-12 can swap with 10 if you want onboarding earlier.

---

## Git commit rhythm (Week 2)

| When | Action |
|------|--------|
| After each phase | One commit (or two if API + mobile split) |
| Message format | `feat(mobile): ...` or `feat(api): ...` |
| Push | `git push origin dev` at least daily |
| Avoid | `git push --force`, merging to `main` until release |
| APK | New EAS build only after Phase 15 sign-off |

---

## Item checklist (1-20 locked to your instructions)

| # | Phase(s) | Locked note |
|---|----------|-------------|
| 1 | 1, all | Shared UI kit |
| 2 | 1 | Mobile-first fonts, not admin clone |
| 3 | 1, 4, 9 | Placeholder always, no broken images |
| 4 | 7, 13 | Haptics + press + refresh |
| 5 | 1 light, 10 toggle, 14 dark | Designed dark, not black |
| 6 | 3 shell, 5 | Real dashboard, no link buttons |
| 7 | 3, 8, 10 | No role/API on UI; staff by affordance |
| 8 | 6 | Loans / Reservations / History |
| 9 | 2, 4 | 15 per page, filters, grid/list |
| 10 | 4, 8 | Student: no QR/IDs; staff: print labels |
| 11 | 7 | Full-screen scan UX |
| 12 | 7 | Retry + staff scan history |
| 13 | 3, 9 | Physical + E-books inside Catalog |
| 14 | 9 | Reader, progress, rating |
| 15 | 10 | Settings hub; photo later |
| 16 | 5, 11 | Badges, mark read, deep links |
| 17 | 1, 4, 6, 13 | Errors + skeletons everywhere |
| 18 | 5, 13 | Session cache |
| 19 | 12 | Carousel + optional coach marks |
| 20 | 4 | Search + recent + ISBN |

---

## What we will not do in this plan

- Admin portal theme sync (Week 2+ later)
- Profile photo upload (separate sub-phase)
- Native push banners (post Expo Go)
- Breaking QR payload format (print only changes presentation)

---

## Your review

When approved, say **start Phase 0** or **start Phase 1** and we implement in order without skipping regression steps.
