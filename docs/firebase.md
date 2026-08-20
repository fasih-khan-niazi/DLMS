# Firebase & Firestore in DLMS

## What is Firebase?

**Firebase** is Google’s backend platform. Instead of building and hosting every backend piece yourself, Firebase gives ready services:

| Service | What it is | How DLMS uses it |
|---------|------------|------------------|
| **Firebase Authentication** | Login system (email/password) | Students/librarians/admins sign in. The app gets a secure ID token. |
| **Cloud Firestore** | NoSQL database (documents & collections) | Stores users, books, copies, loans, reservations, config, reports. |
| **Cloud Storage** | File storage | Planned for PDFs later (blocked on Spark for new projects). |
| **Cloud Messaging (FCM)** | Push notifications | Due-date / overdue / reservation alerts later. |
| **Firebase Hosting** | Static website hosting | Admin web panel later. |

Think of Firebase as:

- **Auth** = “Who is this person?”
- **Firestore** = “Where we store the library data”
- **Our Express API** = “The rules and business logic that Authand Firestore alone shouldn’t trust from the phone”

## What is Firestore?

**Firestore** is Firebase’s database. Data is stored as:

- **Collections** → folders of related documents  
- **Documents** → one record (like one user, one book, one loan)

Example:

```text
users/
  {uid}                 → one student or librarian
catalog/
  9780141036144         → one book title (by ISBN)
bookCopies/
  cpy_abc123            → one physical copy with a QR code
loans/
  loan_xyz789           → one borrow transaction
config/
  system                → fine amount, borrow limit, etc.
```

Unlike SQL tables, documents can nest fields freely and scale well for apps like this.

## How the pieces talk

```text
Phone App
  ├─ Firebase Auth  → login / get ID token
  ├─ (reads later)  → optional direct Firestore reads
  └─ Express API    → borrow, return, add books, change roles
         │
         ├─ verifies ID token with Firebase Admin SDK
         ├─ reads/writes Firestore
         └─ calls Google Books API (ISBN lookup)
```

### Important design rule

Sensitive actions go through **Express**, not directly from the phone into Firestore writes:

- borrow / return
- add copies
- mark fines paid
- promote roles

That prevents someone from cheating (e.g. marking a book available from a modified app).

## Spark plan note

We stay on **Firebase Spark (free)**:

- Auth ✅
- Firestore ✅
- FCM ✅
- Hosting ✅ (later)
- Storage ❌ for now on new projects (needs Blaze) → PDF phase deferred / alternate plan later
