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

- Home **Alerts** chip (shows unread badge)
- Profile -> Notifications
- Tap a row to mark it read

## Later (dedicated app build)

OS push banners need a development/store build. Token registration stays in place;
Expo Go SDK 53+ limits remote push.
