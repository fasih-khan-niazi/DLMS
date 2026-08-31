import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

function serializeNotification(id: string, data: Record<string, any>) {
  const sentAt = data.sentAt?.toDate?.()
    ? data.sentAt.toDate().toISOString()
    : data.sentAt || null;
  return {
    id,
    userId: data.userId,
    type: data.type || "info",
    title: data.title || "",
    body: data.body || "",
    read: Boolean(data.read),
    sentAt,
    loanId: data.loanId || null,
    reservationId: data.reservationId || null,
    isbn: data.isbn || null,
    copyId: data.copyId || null,
    digitalBookId: data.digitalBookId || null,
  };
}

// List current user's notifications (newest first)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const snap = await db
      .collection("notifications")
      .where("userId", "==", req.uid)
      .limit(limit)
      .get();

    const items = snap.docs
      .map((doc) => serializeNotification(doc.id, doc.data()))
      .sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));

    const seen = new Set<string>();
    const collapsed = items.filter((n) => {
      const day = String(n.sentAt || "").slice(0, 10);
      const key = `${n.type}|${n.loanId || n.reservationId || n.title}|${day}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const unreadCount = collapsed.filter((n) => !n.read).length;

    res.json({ items: collapsed, unreadCount });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

router.get("/unread-count", async (req: AuthRequest, res: Response) => {
  try {
    const snap = await db
      .collection("notifications")
      .where("userId", "==", req.uid)
      .where("read", "==", false)
      .limit(100)
      .get();
    const seen = new Set<string>();
    let unreadCount = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const sent = data.sentAt?.toDate?.()
        ? data.sentAt.toDate().toISOString()
        : String(data.sentAt || "");
      const key = `${data.type || ""}|${data.loanId || data.reservationId || data.title || ""}|${sent.slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unreadCount += 1;
    }
    res.json({ unreadCount });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ error: "Failed to count unread notifications" });
  }
});

router.patch("/:notificationId/read", async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = req.params.notificationId as string;
    const ref = db.collection("notifications").doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.userId !== req.uid) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    await ref.update({ read: true });
    res.json({ success: true, id: notificationId });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.post("/read-all", async (req: AuthRequest, res: Response) => {
  try {
    const snap = await db
      .collection("notifications")
      .where("userId", "==", req.uid)
      .where("read", "==", false)
      .limit(200)
      .get();

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    if (!snap.empty) await batch.commit();

    res.json({ success: true, updated: snap.size });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

export default router;
