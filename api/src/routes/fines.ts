import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { assertCollectTarget, collectFines, lookupFinesByEmail } from "../services/fines";
import { notifyUser } from "../services/notifications";

const router = Router();

router.use(authenticate);
router.use(requireRole("librarian", "admin"));

router.get("/lookup", async (req: AuthRequest, res: Response) => {
  try {
    const result = await lookupFinesByEmail(String(req.query.email || ""));
    const denied = assertCollectTarget({
      actorUid: req.uid!,
      actorRole: req.role || "",
      targetUid: result.user.uid,
      targetRole: result.user.role,
    });
    if (denied) {
      const map: Record<string, [number, string]> = {
        CANNOT_COLLECT_OWN: [403, "You cannot record a fine payment on your own account."],
        STUDENTS_ONLY: [403, "Librarians can only collect fines from students. Ask an admin for staff fines."],
        NOT_A_PATRON: [403, "This account cannot have fines collected here."],
      };
      const mapped = map[denied] || [403, "Not allowed"];
      res.status(mapped[0]).json({ error: mapped[1] });
      return;
    }
    res.json(result);
  } catch (error: any) {
    const map: Record<string, [number, string]> = {
      EMAIL_REQUIRED: [400, "Enter a valid email address."],
      USER_NOT_FOUND: [404, "No library account uses that email."],
    };
    const mapped = map[error.message];
    if (mapped) {
      res.status(mapped[0]).json({ error: mapped[1] });
      return;
    }
    console.error("Fine lookup error:", error);
    res.status(500).json({ error: "Failed to look up fines" });
  }
});

router.post("/collect", async (req: AuthRequest, res: Response) => {
  try {
    const result = await collectFines({
      actorUid: req.uid!,
      actorRole: req.role || "",
      email: String(req.body?.email || ""),
      amount: Number(req.body?.amount),
    });

    const remainingNote =
      result.outstanding > 0
        ? ` Remaining balance is Rs ${result.outstanding}.`
        : " All outstanding fines are cleared. Any books still on loan must be returned with Scan.";

    await notifyUser({
      userId: result.user.uid,
      type: "fine_paid",
      title: "Fine payment recorded",
      body: `Rs ${result.collected} was recorded at the desk.${remainingNote}`,
      metadata: {
        amount: String(result.collected),
        outstanding: String(result.outstanding),
      },
    });

    res.json({
      ...result,
      message: `Recorded Rs ${result.collected}.${remainingNote}`,
    });
  } catch (error: any) {
    const map: Record<string, [number, string]> = {
      EMAIL_REQUIRED: [400, "Enter a valid email address."],
      USER_NOT_FOUND: [404, "No library account uses that email."],
      AMOUNT_INVALID: [400, "Enter a whole rupee amount greater than 0."],
      NO_FINES: [409, "This account has no outstanding fines."],
      CANNOT_COLLECT_OWN: [403, "You cannot record a fine payment on your own account."],
      STUDENTS_ONLY: [403, "Librarians can only collect fines from students. Ask an admin for staff fines."],
      NOT_A_PATRON: [403, "This account cannot have fines collected here."],
    };
    const mapped = map[error.message];
    if (mapped) {
      res.status(mapped[0]).json({ error: mapped[1] });
      return;
    }
    console.error("Fine collect error:", error);
    res.status(500).json({ error: "Failed to record the fine payment" });
  }
});

export default router;
