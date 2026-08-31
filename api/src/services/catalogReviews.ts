import { db } from "../config/firebase";
import { summarizeReviews } from "./digitalBookReviews";

function reviewsRef(isbn: string) {
  return db.collection("catalog").doc(isbn).collection("reviews");
}

export async function listCatalogReviews(isbn: string) {
  const snap = await reviewsRef(isbn).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map((doc) => ({ reviewId: doc.id, ...doc.data() }));
}

export async function getCatalogUserReview(isbn: string, userId: string) {
  const snap = await reviewsRef(isbn).doc(userId).get();
  if (!snap.exists) return null;
  return { reviewId: snap.id, ...snap.data() };
}

export async function upsertCatalogReview(input: {
  isbn: string;
  userId: string;
  displayName: string;
  rating: number;
  recommendScore?: number | null;
  comment?: string;
  confirm?: boolean;
}) {
  const ref = reviewsRef(input.isbn).doc(input.userId);
  const existing = await ref.get();
  const existingData = existing.exists ? (existing.data() as Record<string, unknown>) : null;

  if (existingData?.confirmed) {
    throw new Error("Review already submitted and cannot be changed");
  }

  const now = new Date();
  const payload = {
    userId: input.userId,
    displayName: input.displayName.trim() || "Student",
    rating: input.rating,
    recommendScore:
      input.recommendScore === undefined || input.recommendScore === null
        ? null
        : Math.min(10, Math.max(1, Math.round(input.recommendScore))),
    comment: String(input.comment || "").trim().slice(0, 500),
    confirmed: input.confirm === true,
    updatedAt: now,
    ...(existing.exists ? {} : { createdAt: now }),
  };
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { reviewId: updated.id, ...updated.data() };
}

export { summarizeReviews };
