# Business logic VnV matrix (Block F)

Verification and validation against the implemented Express + Firestore rules. Use this for demo rehearsal and viva. No em dashes.

**How to use:** walk each row once on a clean seed (or known test users). Mark `Result` as Pass / Fail / N/A. Defaults below assume system config has not been overridden in Admin.

## Default configuration (source of truth)

| Key | Default | Where enforced |
|-----|---------|----------------|
| `maxBorrowLimit` | 5 | `POST /api/loans/borrow` |
| `loanPeriodDays` | 14 | `calculateDueDate` after borrow |
| `finePerDayRs` | 50 | Return + daily overdue job |
| `reservationHoldHours` | 72 | Assign ready reservation |
| `blockCheckoutIfUnpaidFine` | true | Borrow + create reservation |
| `workingDaysOff` | Sunday | Due-date roll-forward |
| `librariansCanBorrow` | true | Borrow |
| `maxPdfSizeMb` | 25 | Digital PDF upload |
| `timezone` | Asia/Karachi | Due dates, cron, reports |

Implementation: `api/src/services/loans.ts` (`getSystemConfig`), Admin Config page, seed script.

---

## A. Auth and roles

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| A1 | New register is always student | Register via mobile/API | Profile `role: student`; cannot call admin config | `routes/auth.ts` | |
| A2 | Password min length 8 | Register with 7-char password | 400 | `routes/auth.ts` | |
| A3 | Only admin changes roles | Student `POST /api/admin/users/:uid/role` | 403 | `requireRole("admin")` | |
| A4 | Disabled user blocked | Set `isActive: false`, call `/api/auth/me` | 403 Account disabled | `middleware/authenticate.ts` | |
| A5 | Librarian cannot open admin-only Users page APIs | Librarian `GET /api/admin/users` | 403 | `routes/admin.ts` | |
| A6 | Staff can use catalog write APIs | Librarian add book | 201 / success | `routes/catalog.ts` | |

---

## B. Borrow (physical)

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| B1 | Borrow via `copyId` or QR `copyId_isbn` | Scan / API with each form | Loan created, copy `issued` | `routes/loans.ts` | |
| B2 | Max active loans | Borrow until limit (default 5) | 6th fails with borrow limit | borrow tx | |
| B3 | Unpaid fine blocks checkout | User with `hasUnpaidFines`, try borrow | 403 clear fines | borrow tx | |
| B4 | Cannot borrow issued copy | Borrow same copy twice | 409 already issued | borrow tx | |
| B5 | Damaged copy blocked | Mark copy damaged, borrow | 409 damaged | borrow tx | |
| B6 | Reserved for other user | Copy `reserved` for user A, user B borrows | 409 reserved for other | borrow tx | |
| B7 | Ready holder can claim | User with `ready` reservation for copy | Borrow OK; reservation `fulfilled` | borrow tx | |
| B8 | Waiting reservation cleared on borrow same ISBN | User waiting + somehow borrows | Waiting row cancelled | post-borrow cleanup | |
| B9 | Catalog counts | Borrow available copy | `availableCount` -1, `issuedCount` +1 | borrow tx | |
| B10 | Librarian borrow flag | Set `librariansCanBorrow: false` | Librarian borrow 403 | borrow tx | |
| B11 | Inactive account | Suspended user borrow | 403 | borrow tx | |

---

## C. Due dates

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| C1 | Base period | Borrow on a normal day | Due ≈ issue + `loanPeriodDays` (default 14) | `calculateDueDate` | |
| C2 | Sunday roll-forward | Force due onto Sunday (or set `workingDaysOff`) | Due moves to next working day | `calculateDueDate` | |
| C3 | Holiday roll-forward | Add holiday date matching would-be due | Due moves past holiday | holidays collection | |
| C4 | Timezone | Compare due calendar date in Karachi | Matches Asia/Karachi date keys | `toDateKey` | |

---

## D. Return and fines

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| D1 | Owner can return | Borrower scans return | Loan `returned`, copy available (or reserved if queue) | `POST /return` | |
| D2 | Staff can return for student | Librarian returns student copy | Same as D1 | return auth check | |
| D3 | Stranger cannot return | Other student returns | 403 not allowed | return tx | |
| D4 | On-time fine is zero | Return before/at due | `fineAmount` 0, `finePaid` true | `calculateFineAmount` | |
| D5 | Late fine | Return N days after due | `ceil(lateDays) * finePerDayRs` | `calculateFineAmount` | |
| D6 | Outstanding flags | Late return | User `hasUnpaidFines` true; totals increase | return tx | |
| D7 | Mark fine paid | Admin/librarian mark paid | Flags cleared for that loan / user totals | admin fine routes | |
| D8 | Return then unpaid blocks next borrow | After D6, try new borrow | 403 if `blockCheckoutIfUnpaidFine` | B3 | |
| D9 | Active borrow count | Return | `activeBorrowCount` decremented | return tx | |

---

## E. Reservations

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| E1 | Reserve only if none available | Title with `availableCount` > 0 | 409 borrow instead | `POST /reservations` | |
| E2 | Cannot reserve if already on loan for ISBN | Active loan same ISBN | 409 | reservations route | |
| E3 | One active reservation per user+ISBN | Create twice while waiting/ready | Second 409 | reservations route | |
| E4 | Unpaid fine blocks reserve | Same as B3 | 403 | reservations route | |
| E5 | FIFO queue | Two waiters, return one copy | Earliest `createdAt` gets `ready` | `assignCopyToNextReservation` | |
| E6 | Hold duration | Inspect `expiresAt` on ready | ≈ now + `reservationHoldHours` (72h) | assign service | |
| E7 | Ready notification record | After assign | In-app notification type `reservation_ready` | `notifyUser` | |
| E8 | Claim via borrow | Ready user borrows assigned copy | Reservation `fulfilled` | B7 | |
| E9 | Expiry cron | Force `expiresAt` in past, run expiry job | Status `expired`; copy to next waiter or available | `expireReadyReservationHolds` | |
| E10 | Queue position | Two waiters, call `/mine` | Positions 1 then 2 | `computeQueuePosition` | |
| E11 | Cancel waiting | Owner deletes waiting reservation | Cancelled / removed from queue | `DELETE /reservations/:id` | |

---

## F. Digital library

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| F1 | Auth required to list/stream | No token | 401 | `digitalBooks` routes | |
| F2 | Only staff upload | Student upload | 403 | `requireRole` | |
| F3 | Size limit from config | Upload > `maxPdfSizeMb` | 400 exceeds limit | upload route + multer ceiling | |
| F4 | Non-PDF rejected | Upload `.txt` | 400 only PDF | `uploadPdf` filter | |
| F5 | Bookshelf progress 0-100 | PATCH progress | Stored and returned on mine | digital routes | |
| F6 | Rating 1-5 | Invalid 6 | Rejected / clamped per API | digital routes | |

---

## G. Notifications and cron

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| G1 | In-app list | Open Notifications on mobile | Rows from Firestore for user | notifications API | |
| G2 | Due reminders | Loan due in 1-2 days; run daily job | Reminder notifications created | `runDailyLoanNotifications` | |
| G3 | Overdue alert | Past-due active loan; run daily job | Overdue notification | same | |
| G4 | Cron HTTP secret | Hit `/internal/cron/...` without secret | 403 / 503 if unset | `cronAuth` | |
| G5 | In-process schedules | API boot logs | Daily midnight + every 6h reservation expiry (Karachi) | `cron/index.ts` | |

---

## H. Admin and reports

| ID | Requirement | How to verify | Expected result | Code | Result |
|----|-------------|---------------|-----------------|------|--------|
| H1 | Config save applies | Change `maxBorrowLimit` to 2, borrow 3rd | 403 limit | admin config + B2 | |
| H2 | PDF size config applies | Set `maxPdfSizeMb` to 1, upload 2MB | 400 | F3 | |
| H3 | Dashboard metrics | Open Dashboard | Counts load for staff | admin routes | |
| H4 | Reports range | Load summary for dates | Metrics + daily series | reports routes | |
| H5 | CSV export | Download CSV | File opens with summary/daily/loan sections | `export.csv` | |
| H6 | PDF export | Download PDF | PDF opens with summary + daily | `export.pdf` | |

---

## Validation summary (design intent)

| Area | Validated against product intent? | Notes |
|------|-----------------------------------|--------|
| Student self-serve borrow/return/reserve | Yes | QR + API rules match MVP |
| Fine blocking | Yes | Configurable |
| FIFO 72h hold | Yes | Hold hours configurable |
| Role separation | Yes | Admin web vs mobile floor work |
| Digital PDF via API proxy | Yes | Supabase private; no client service key |
| OS push banners | Partial | In-app inbox is MVP; Expo Go limits remote push |

---

## Suggested 20-minute demo path

1. Login student -> catalog -> borrow one copy (B1, C1).
2. Hit borrow limit briefly or show unpaid fine path if prepared (B2/B3).
3. Second student reserves unavailable title (E1, E5).
4. Return copy -> first waiter ready notification (E5-E7).
5. Claim borrow -> fulfilled (E8).
6. Staff upload small PDF; open in E-Library (F2-F5).
7. Admin: tweak config, show reports CSV + PDF (H1, H4-H6).
8. Mention security checklist (`docs/security.md`) and this matrix.

## Status legend

Leave `Result` blank until you run the case. After rehearsal, fill Pass/Fail. Failures should become bug tickets or known-limits notes before tag `v1.0.0-mvp` (Block G).
