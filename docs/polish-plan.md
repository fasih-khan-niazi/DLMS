# Completion and park plan

Aggressive polish after Phases 1-8. Goal: demo-ready product, then freeze.

No em dashes in docs or UI copy.

## Blocks

| Block | Focus |
|-------|--------|
| **A** | Design system, better logins, forgot password (email reset link) |
| **B** | Mobile UI polish, skeletons, motion, **in-app notifications list** |
| **C** | Admin UI polish, better config grouping |
| **D** | PDF report export (+ CSV already done) |
| **E** | Security checklist |
| **F** | Business logic VnV matrix |
| **G** | Demo script, seed, tag `v1.0.0-mvp`, park |

## Notifications (two layers)

1. **In-app notifications (Block B)**  
   List rows from Firestore `notifications` (already written by the API). Inbox on mobile (and optionally admin). Works without Expo Go push.

2. **OS / dedicated push (later, post Expo Go)**  
   When you ship a **development build** or store build, use native FCM / Expo notifications fully. Expo Go (SDK 53+) cannot do full remote push. Plan: keep token registration; enable real banners in a dedicated build.

## Password reset

Firebase Auth **email reset link** (not custom OTP):

- User enters email -> `sendPasswordResetEmail`
- Firebase emails a link -> user sets a new password
- Requires Firebase Console: Authentication -> Templates / authorized domains

OTP would need a separate email/SMS provider; out of scope for park unless required by supervisors.

## Design tokens

- Navy `#2E4A62`, cream `#F8F7F4`, amber `#E8A838`
- Admin fonts: Fraunces (display) + DM Sans (UI)
- Mobile: same color system; system fonts first, Expo fonts optional in Block B

## Status

- Block A: done
- Block B: done (mobile polish starters, Ionicons tabs, skeletons on catalog, in-app notifications inbox)
- Blocks C-G: pending
