# In-app notifications

Firestore written by the API to Firestore `notifications` (due reminders, overdue,
reservation ready). Mobile shows an inbox that works without Expo Go push.

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/notifications` | Current user list + unreadCount |
| GET | `/api/notifications/unread-count` | Badge count |
| PATCH | `/api/notifications/:id/read` | Mark one read |
| POST | `/api/notifications/read-all` | Mark all read |

Auth required (Bearer Firebase ID token).

## Mobile

- Home bell with unread badge
- Profile -> Notifications (unread badge on the row)
- Inbox: unread styling, Mark all read, pull to refresh
- Tap a row: marks it read and opens Activity (loans / reservations) or Catalog book detail when ISBN is present

## Later (dedicated app build)

OS push banners need a development/store build. Token registration stays in place;
Expo Go SDK 53+ limits remote push.
