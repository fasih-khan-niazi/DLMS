import { db } from "../config/firebase";

export type DigitalBookReview = {
  userId: string;
  displayName: string;
  rating: number;
  recommendScore: number | null;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

function reviewsRef(digitalBookId: string) {
  return db.collection("digitalBooks").doc(digitalBookId).collection("reviews");
}

export async function listDigitalBookReviews(digitalBookId: string) {
  const snap = await reviewsRef(digitalBookId).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map((doc) => ({ reviewId: doc.id, ...doc.data() }));
}

export async function getUserReview(digitalBookId: string, userId: string) {
  const snap = await reviewsRef(digitalBookId).doc(userId).get();
  if (!snap.exists) return null;
  return { reviewId: snap.id, ...snap.data() };
}

export async function upsertDigitalBookReview(input: {
  digitalBookId: string;
  userId: string;
  displayName: string;
  rating: number;
  recommendScore?: number | null;
  comment?: string;
}) {
  const ref = reviewsRef(input.digitalBookId).doc(input.userId);
  const existing = await ref.get();
  const now = new Date();
  const payload = {
    userId: input.userId,
    displayName: input.displayName.trim() || "Student",
    rating: input.rating,
    recommendScore:
      input.recommendScore === undefined || input.recommendScore === null
        ? null
        : Math.min(10, Math.max(0, Math.round(input.recommendScore))),
    comment: String(input.comment || "").trim().slice(0, 500),
    updatedAt: now,
    ...(existing.exists ? {} : { createdAt: now }),
  };
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { reviewId: updated.id, ...updated.data() };
}

export function summarizeReviews(reviews: Array<Record<string, unknown>>) {
  if (reviews.length === 0) {
    return { count: 0, averageRating: null, recommendPercent: null };
  }
  const ratings = reviews.map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
  const nps = reviews
    .map((r) => r.recommendScore)
    .filter((v) => v !== null && v !== undefined)
    .map(Number)
    .filter((n) => n >= 0 && n <= 10);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
  const promoters = nps.filter((n) => n >= 9).length;
  const detractors = nps.filter((n) => n <= 6).length;
  const recommendPercent =
    nps.length > 0 ? Math.round(((promoters - detractors) / nps.length) * 100) : null;
  return { count: reviews.length, averageRating, recommendPercent };
}
