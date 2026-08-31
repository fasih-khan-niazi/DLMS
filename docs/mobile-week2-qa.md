# Week 2 QA and Phase X verification

Covers the Phase X pass: critical bug fixes plus Phases 13, 14 and 16.
Branch: **`dev`**. Test with **Expo Go**.

No em dashes in UI copy.

---

## 1. What Phase X changed

### Critical fixes

| # | Symptom you reported | Root cause | Fix |
|---|----------------------|------------|-----|
| 1 | Bookshelf add/remove showed "Something went wrong" although the API succeeded | `invalidateDigitalCache()` was called in `DigitalBookDetailScreen` but never imported. The `ReferenceError` fired **after** the successful request and was swallowed by the same `catch` that renders API errors | Import added, and every mutation restructured so only the network call sits inside `try` |
| 2 | Scan borrow/return could report failure after a successful scan | Same class of bug: `void refresh()` in `ScanScreen` with `refresh` never destructured from `useProfile()` | `refresh` destructured, and the success path moved outside `try` |
| 3 | "Allow in-app copy borrow/return" never stayed ticked | The admin portal's `VITE_API_URL` points at the **Render Week 1 API**, which does not have `allowInAppCopyBorrow` in its allow-list. It silently dropped the field and echoed back a config without it, so the checkbox reset | API now returns `supportedFields` / `appliedFields`; the portal detects a backend that cannot store a setting, warns, and disables the control instead of silently reverting |
| 4 | Librarian Scan gate: toast late, haptic out of sync, felt like a double fire | The gate awaited two network calls before giving any feedback, and the tab press was always `preventDefault`ed | Gate decision is now a synchronous, background-refreshed snapshot. Blocked presses fire haptic and toast in the same tick; allowed presses navigate natively with no delay |

### Phase 13 (motion, haptics, perf)

- Success haptics on borrow, return, reserve, cancel reservation, bookshelf add/remove, review save, PDF upload.
- Pull-to-refresh added to Home (was the only list screen without it); it skips the cached snapshot and busts the catalog and digital caches.
- Mutation handlers now use a shared `extractApiError` helper, so a network fault, a timeout and a server rejection each read differently.

### Phase 14 (dark theme completion)

- `AddBookScreen` was fully hardcoded to the light palette. Rebuilt on theme tokens and shared `Input` / `Button` / `AppModal` primitives.
- `EmptyState` used the static light palette import. Now uses `useTheme()`.
- Scan overlay used `colors.white` for text and icons. In dark mode that token is a dark navy, so the back chevron, title, torch and Borrow/Return labels were nearly invisible over the camera. The overlay now uses fixed on-camera colours.
- `StatusBar` forced to light on the auth shell and the Scan camera, both of which are dark in either theme.

### Phase 16 (former Phase R: circulation and queues)

- `GET /api/catalog/books/:isbn` now derives `availableCount` / `issuedCount` / `reservedCount` from the live copy rows instead of trusting stored counters, and writes the corrected values back. A drifted counter can no longer keep a returned book showing as issued or reserved.
- Cancelling a reservation busts the mobile catalog cache, so freed copies appear without a manual refresh.
- Config booleans are coerced server-side, so a string `"false"` can never be stored as a truthy value.

---

## 2. Verification scripts

Run from `api/`. All of them use the service account in `secrets/`.

| Command | What it proves | Writes data? |
|---------|----------------|--------------|
| `npm run verify` | Config booleans are real booleans; no counter drift, starved queues, orphan reserved copies, broken ready holds, or issued copies without an active loan | No |
| `npm run verify:heal` | Same audit, then runs `reconcileAllWaitingQueues()` and re-audits | Yes, heals only |
| `npm run verify:config` | Full admin config round trip over HTTP: persist, re-read, mobile endpoint agreement, string coercion. Restores the original value | Yes, self-restoring |
| `npm run verify:flow` | Phase 16 acceptance: A borrows, B reserves, A returns, B goes ready on a real held copy, B claims, shelf restored, catalog counts match | Yes, self-restoring |
| `npm run inspect:copy -- <copyId>` | Read-only dump of one copy and its active loan | No |

`verify:config` accepts a base URL, which is how the Render diagnosis was confirmed:

```bash
npm run verify:config                                  # local API
npx tsx scripts/verify-config-http.ts https://dlms-csij.onrender.com
```

---

## 3. Results from this pass

`npm run verify` against the live Firestore:

```text
--- System config ---
  blockCheckoutIfUnpaidFine: true (boolean)
  librariansCanBorrow: false (boolean)
  allowInAppCopyBorrow: false (boolean)

--- Circulation integrity ---
  13 titles, 26 copies, 5 reservations
  counter drift: 0 title(s)
  starved queues: 0
  orphan reserved copies: 0
  broken ready holds: 0
  issued copies without an active loan: 0
PASS: no issues found
```

Before the fix, `allowInAppCopyBorrow` read `undefined (unset)`: it had **never** been written to
Firestore, despite many saves. Other fields such as `loanPeriodDays` had saved fine. That is the
signature of a backend that allow-lists config fields and silently drops unknown ones.

`verify:config` against **local** API: all checks pass.
`verify:config` against **Render**: `supportedFields: 0`, and `PUT` returns
`No allowed config fields provided`. Definitive confirmation.

---

## 4. Required action before the in-app borrow toggle works

The API the portal talks to must be one that knows the setting. Pick one:

**Option A, local development.** In `admin/.env` set:

```text
VITE_API_URL=http://localhost:5000
```

Then restart the admin dev server. The Config page now prints `Connected API:` at the top, so you
can confirm at a glance.

**Option B, production.** Redeploy the Render API from `dev` (or from `main` after the Week 2
merge). Until then the portal shows a warning and disables that one checkbox.

The mobile app already points at the LAN API (`mobile/.env`), which is why config changes were
never visible on the phone either.

---

## 5. Manual smoke script (Expo Go)

### Digital bookshelf, fix 1

1. Open Catalog, E-books tab, pick any title.
2. Tap **Add to bookshelf**. Expect the **success** modal only, plus a success haptic.
3. Tap **Remove from bookshelf** and confirm. Expect no error modal.
4. Save a review. Expect the success modal only.

Pass criteria: no "Something went wrong" at any point, and no two modals stacked.

### Scan borrow and return, fix 2

1. Student account, Scan tab, Borrow, scan a shelf QR.
2. Expect the **success** sheet with title and due date, and a success haptic.
3. Switch to Return, scan the same QR. Expect the success sheet.
4. Open Catalog. The availability chip must already be current without a manual refresh.

Pass criteria: no "Scan action failed" on a scan that the API log shows as 200.

### Librarian Scan gate, fix 4

Precondition: Config has `librariansCanBorrow` off, and the librarian has no active loans.

1. Librarian account, tap the **Scan** tab.
2. Expect exactly **one** toast and a warning haptic **at the same instant** as the tap.
3. Give the librarian an active loan, then tap Scan again. It should open in return-only mode.
4. Turn `librariansCanBorrow` back on. Within 30 seconds, or immediately after the background
   revalidate, Scan opens normally.

Pass criteria: one toast, no perceptible delay, no delay when the gate is open.

### In-app copy borrow toggle, fix 3

1. Complete section 4 above so the portal talks to a capable API.
2. Config, tick **Allow in-app copy borrow/return**, Save.
3. Reload the page. The box must still be ticked.
4. Mobile: pull to refresh a physical book detail. Borrow and Return buttons appear on copies.
5. Untick, save, pull to refresh. The buttons disappear.

### Dark mode, Phase 14

Toggle dark mode in Profile, then check:

- Login and Register: navy hero, readable card, light status bar icons.
- Catalog and E-books while loading: skeletons visible, not black on black.
- Scan tab: back chevron, "Scan" title, torch icon and Borrow/Return labels all clearly visible
  over the camera feed.
- Profile, Add physical book: fields, labels and buttons all readable.
- Any empty state, for example Reservations with nothing in it.

Dark mode is device-global, stored in AsyncStorage, and is not per account.

---

## 6. Known gaps and next steps

- **Admin portal** needs a broader pass (theme sync, validation, error surfacing). Deferred by
  decision; the Config page now at least reports the connected API and unsupported settings.
- **Interactive sandbox onboarding** stays parked. The current role-based slides are sufficient.
- **Profile photo upload** remains a post-Phase 15 sub-phase.
- **Native push banners** still need a dev build; Expo Go cannot show them.
- `verify:flow` requires a single-copy title with no live reservations. The API correctly refuses a
  reservation while another copy is on the shelf, so a multi-copy title cannot exercise the queue.
