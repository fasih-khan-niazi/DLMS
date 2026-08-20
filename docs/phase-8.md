# Phase 8 notes

## Mobile tabs

Bottom tabs: **Home**, **Catalog**, **Scan**, **Activity**, **Profile**.

- Activity = Loans + Reservations switcher
- E-Library / staff tools from Home and Profile stacks
- Firebase Auth persists with AsyncStorage

Reload Expo after pulling (`npx expo start` is enough; use `-c` only if Metro acts up).

## Admin reports

Sidebar → **Reports**: date range, metric cards, daily table, CSV download.

API:

- `GET /api/admin/reports/summary?from=&to=`
- `GET /api/admin/reports/export.csv?from=&to=`

Librarian or admin Bearer token required.
