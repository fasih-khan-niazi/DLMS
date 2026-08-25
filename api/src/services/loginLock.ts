import { db } from "../config/firebase";

const MAX_ATTEMPTS = 3;
const LOCK_MS = 15 * 60 * 1000;

function normalizeEmail(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function lockDocId(email: string) {
  // Firestore doc ids cannot contain /
  return normalizeEmail(email).replace(/\//g, "_");
}

export type LockStatus = {
  email: string;
  locked: boolean;
  failedAttempts: number;
  attemptsRemaining: number;
  lockedUntil: Date | null;
  lockedForSeconds: number;
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getLoginLockStatus(emailRaw: string): Promise<LockStatus> {
  const email = normalizeEmail(emailRaw);
  const ref = db.collection("loginLocks").doc(lockDocId(email));
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    return {
      email,
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: MAX_ATTEMPTS,
      lockedUntil: null,
      lockedForSeconds: 0,
    };
  }

  const data = snap.data()!;
  const lockedUntil = toDate(data.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > now) {
    return {
      email,
      locked: true,
      failedAttempts: Number(data.failedAttempts) || MAX_ATTEMPTS,
      attemptsRemaining: 0,
      lockedUntil,
      lockedForSeconds: Math.ceil((lockedUntil.getTime() - now) / 1000),
    };
  }

  // Lock expired — clear for a clean slate
  if (lockedUntil && lockedUntil.getTime() <= now) {
    await ref.set(
      { failedAttempts: 0, lockedUntil: null, updatedAt: new Date() },
      { merge: true }
    );
    return {
      email,
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: MAX_ATTEMPTS,
      lockedUntil: null,
      lockedForSeconds: 0,
    };
  }

  const failedAttempts = Number(data.failedAttempts) || 0;
  return {
    email,
    locked: false,
    failedAttempts,
    attemptsRemaining: Math.max(MAX_ATTEMPTS - failedAttempts, 0),
    lockedUntil: null,
    lockedForSeconds: 0,
  };
}

export async function recordLoginAttempt(input: {
  email: string;
  success: boolean;
}): Promise<LockStatus> {
  const email = normalizeEmail(input.email);
  const ref = db.collection("loginLocks").doc(lockDocId(email));
  const now = new Date();

  if (input.success) {
    await ref.set(
      {
        email,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
        lastSuccessAt: now,
      },
      { merge: true }
    );
    return {
      email,
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: MAX_ATTEMPTS,
      lockedUntil: null,
      lockedForSeconds: 0,
    };
  }

  // Failed attempt
  const current = await getLoginLockStatus(email);
  if (current.locked) {
    return current;
  }

  const failedAttempts = current.failedAttempts + 1;
  if (failedAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + LOCK_MS);
    await ref.set(
      {
        email,
        failedAttempts: MAX_ATTEMPTS,
        lockedUntil,
        updatedAt: now,
        lastFailedAt: now,
      },
      { merge: true }
    );
    return {
      email,
      locked: true,
      failedAttempts: MAX_ATTEMPTS,
      attemptsRemaining: 0,
      lockedUntil,
      lockedForSeconds: Math.ceil(LOCK_MS / 1000),
    };
  }

  await ref.set(
    {
      email,
      failedAttempts,
      lockedUntil: null,
      updatedAt: now,
      lastFailedAt: now,
    },
    { merge: true }
  );

  return {
    email,
    locked: false,
    failedAttempts,
    attemptsRemaining: MAX_ATTEMPTS - failedAttempts,
    lockedUntil: null,
    lockedForSeconds: 0,
  };
}
