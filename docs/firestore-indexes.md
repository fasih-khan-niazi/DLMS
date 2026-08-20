# Firestore Indexes Needed

Create these composite indexes in Firebase Console → Firestore → Indexes
when the console prompts you (or ahead of time):

## reservations

1. Collection: `reservations`
   - Fields: `isbn` Ascending, `status` Ascending, `createdAt` Ascending
   - Used by: next waiting reservation lookup (FIFO)

2. Collection: `reservations`
   - Fields: `userId` Ascending, `assignedCopyId` Ascending, `status` Ascending
   - Used by: claim/borrow of a ready reserved copy

If a query fails at runtime, Firestore returns a link in the API error/log
to auto-create the missing index — open that link while signed into the project.

## Note (Phase 4 hardening)

Reservation FIFO lookup now sorts **in memory** after filtering by
`isbn` + `status == waiting`, so the composite `createdAt` index is **not required**
for return → assign to work. Keeping the index is still fine for larger scale later.
