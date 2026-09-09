# DLMS Application Guide

**Version:** `v2.0.0` 

**Scope:** Physical circulation, fines, reservations, digital library, and admin configuration as implemented today.

---

## 1. Overview

DLMS has three user roles and two main surfaces:

| Role | Where they work | Primary purpose |
|------|-----------------|-----------------|
| **Student** | Mobile app | Borrow, return, reserve, read e-books |
| **Librarian** | Mobile app | Floor operations plus catalog and fine desk tools |
| **Admin** | Admin web portal | Users, configuration, oversight, reports |

Students and librarians use the mobile app only. The admin portal is for administrators. Librarians cannot sign in to the admin portal.

---

## 2. Physical Books

### 2.1 Borrowing

**Normal flow**

1. Open the **Scan** tab.
2. Choose **Borrow**.
3. Scan the QR label on the shelf copy.
4. The loan is created and the due date appears under **Activity**.

**Rules**

- Maximum active loans per user: **5** (configurable).
- Loan period: **14 calendar days** by default, adjusted for Sundays and configured holidays (Pakistan timezone).
- A copy must be **available**, or **reserved for you** if you have a ready hold.
- Damaged, issued, or reserved-for-another copies cannot be borrowed.
- Deactivated titles cannot be borrowed.

**In-app borrow from book detail**

- Disabled by default. When off, borrowing must happen through **Scan**.
- Admin can enable **Allow in-app copy borrow/return** in Config.

### 2.2 Returning

**Normal flow**

1. Open **Scan**.
2. Choose **Return**.
3. Scan the QR on the copy issued to you.

**Rules**

- You may only return a copy that is on your account.
- If you hold another copy of the same title, you must scan **your** copy, not a different one.
- Librarians and admins may return a copy on behalf of another reader.
- If the loan has an **unpaid fine**, return is blocked until payment is recorded at the desk. This rule always applies, regardless of other settings.

### 2.3 Fines on loans

- Fine accrues at **Rs 50 per calendar day** after the due date (default, configurable).
- Calculation uses the configured timezone (default: Asia/Karachi).
- Fines are assessed when the system checks loans (borrow, return attempt, Activity refresh, desk lookup, daily maintenance).

---

## 3. Reservations

Use reservations when **no physical copy is available** on the shelf.

**Create a reservation**

1. Open a title in the catalog.
2. If all copies are out, tap **Reserve**.
3. You join the queue in first-in, first-out order.

**When a copy becomes free**

1. The next person in the queue receives a **ready** hold.
2. A notification is sent.
3. You have **72 hours** (default) to collect the book.
4. Claim the hold by scanning **that copy's** QR label.

**Cancel a reservation**

- Open **Activity** → **Reservations** → cancel while status is **waiting** or **ready**.
- Cancelling a ready hold releases the copy back to the queue or shelf.

**Not allowed**

- Reserve when copies are available (borrow instead).
- Reserve a title you already have on loan.
- Hold two active reservations for the same ISBN.
- Reserve while suspended or while fines block checkout (when that setting is on).

---

## 4. Fines and Desk Collection

### 4.1 What fines block

| Action | Blocked by outstanding fines? |
|--------|------------------------------|
| Return a late copy with unpaid fine on that loan | **Always** |
| New borrow | Only when **Block new borrows and reservations** is on (default: on) |
| New reservation | Only when **Block new borrows and reservations** is on (default: on) |

When blocking is **off**, a reader may still borrow or reserve with a balance, but cannot return the overdue copy until that copy's fine is paid.

### 4.2 Collect fines (mobile, librarian desk)

**Flow**

1. Librarian opens **Collect fines** (Home or Profile).
2. Enter the reader's email and tap **Look up**.
3. Review outstanding balance and line items.
4. Enter cash received (partial or full; whole rupees only).
5. Confirm collection.

**Rules**

- Collecting a payment **does not return a book**. The reader still scans to return.
- Partial payments are applied to the oldest fines first.
- Overpayment is clamped to the remaining balance.
- Librarians may collect from **students only**.
- Admins may collect from students and librarians.
- No one may collect on their own account.

### 4.3 Admin fines page

- Lists patrons with unpaid fines.
- **Mark paid** clears the full fine on a single loan (admin portal flow).
- Mobile desk collection supports partial payments.

---

## 5. Digital Library

Physical circulation rules do **not** apply to e-books.

| Feature | Physical catalog | Digital library |
|---------|------------------|-----------------|
| Borrow / return / fines | Yes | No |
| Reservations | Yes | No |
| Access | QR scan on shelf copy | Open and read in app |
| Staff upload | Add ISBN title + copies | Upload PDF |
| Reviews | Yes, one per title (locked after submit) | Yes, same rule |

**Student flow:** Catalog → **E-books** → open title → read PDF.  
**Staff flow:** Profile → **Upload PDF** (size limit default 25 MB).

---

## 6. Librarian Tools (Mobile)

| Task | Where | Notes |
|------|-------|-------|
| Add physical book | Profile → Add book | ISBN lookup or manual entry; copies get QR labels |
| Print copy label | Book detail → Available copies | QR + copy number |
| Deactivate title | Book detail | Only when no copies are on loan |
| Upload e-book | Profile → Upload PDF | Requires Supabase storage |
| Collect fines | Home or Profile | Email lookup first |
| View inactive titles | Catalog filter | Staff only |

### Librarian borrowing toggle

When **Librarians can borrow physical books** is turned off:

- Librarians cannot borrow or reserve.
- Existing librarian reservations are cancelled automatically.
- **Scan** stays available only for returns if they still have loans.
- If they have zero loans, the Scan tab is blocked until borrowing is re-enabled.

---

## 7. Admin Portal

### 7.1 Users

- Promote **student** ↔ **librarian** only. Admin accounts are seed-only.
- Suspend or activate accounts. Suspended users cannot use the app.
- Clear login lock after repeated failed sign-in attempts (3 failures → 15 minute lock).
- Cannot promote users with unpaid fines, suspend yourself, or change admin accounts.

### 7.2 Configuration

| Setting | Default | What it controls |
|---------|---------|------------------|
| Max borrow limit | 5 | Active loans per user |
| Loan period (days) | 14 | Base due date length |
| Fine per day (Rs) | 50 | Daily overdue charge |
| Reservation hold (hours) | 72 | Pickup window for ready holds |
| Block new borrows and reservations while unpaid fines exist | On | Borrow/reserve gate only; returns still blocked per loan |
| Librarians can borrow physical books | On | Librarian circulation access |
| Allow in-app copy borrow/return | Off | Borrow/return without Scan |
| Catalog page size | 10 | List pagination |
| Max PDF size (MB) | 25 | Digital upload limit |

Due dates also skip configured **working days off** (default: Sunday) and holidays stored in the system.

### 7.3 Other admin pages

- **Dashboard:** Summary counts and activity.
- **Catalog:** View titles; soft-deactivate (same rules as mobile staff).
- **Reservations:** Active queue overview.
- **Fines:** Outstanding balances and mark-paid actions.
- **Reports:** Export circulation data (CSV/PDF).

---

## 8. Authentication

- **Registration** creates a student account (email, password min 8 characters).
- **Login** persists on the device until sign out. Reinstalling or signing out clears the session.
- **Forgot password** uses Firebase email reset.
- **Suspended** accounts are blocked at login and on every API call.

---

## 9. Quick Flow Reference

### Student wants a book on the shelf

Catalog → confirm available → Scan → Borrow → scan QR.

### Student wants a book that is all out

Book detail → Reserve → wait for notification → Scan → Borrow → scan the held copy.

### Student returns a late book

Pay fine at desk (if any) → Scan → Return → scan QR.

### Librarian collects partial fine

Collect fines → email lookup → enter amount → confirm → reader returns via Scan when balance on that loan is clear.

### Admin disables librarian borrowing

Config → uncheck librarian borrowing → Save → librarian reservations are cancelled.

---

## 10. Prohibited Actions (Summary)

**Students cannot**

- Access the admin portal or collect fines.
- Add books, upload PDFs, or deactivate titles.
- Return another reader's copy or the wrong copy of a title.
- Return while the fine on that loan is unpaid.
- Reserve when copies are available or when already holding that title.
- Edit a review after submission.

**Librarians cannot**

- Sign in to the admin portal.
- Collect fines from librarians, admins, or themselves.
- Borrow or reserve when librarian borrowing is disabled.
- Use Scan when borrowing is disabled and they have nothing to return.

**Admins cannot**

- Create or assign admin role through the portal.
- Suspend themselves or modify seed admin accounts.
- Promote users who have unpaid fines.

**System blocks**

- Borrowing damaged or unavailable copies.
- Borrowing a copy reserved for someone else.
- Deactivating a title while copies are on loan.
- In-app borrow by copy ID when that config is off.

---

## 11. Notifications

Readers receive in-app notices for:

- Due date reminders (default: 2 days and 1 day before due)
- Overdue loans with estimated fine
- Reservation ready and reservation expired
- Fine payment recorded at the desk

Duplicate notices for the same event on the same day are suppressed.

---

## 12. Production Setup Notes

- **Mobile APK** connects to the deployed API on Render (`https://dlms-csij.onrender.com`).
- **Local `.env` files** are for development only and are not bundled into client builds.
- **Week 1** is archived at tag `v1.0.0-week1`. **Week 2** is at `v2.0.0-week2` on `main`.

For deployment and seeding, see [`deploy-render.md`](deploy-render.md) and [`seed.md`](seed.md).
