import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { getSystemConfig } from "../services/loans";

const router = Router();

function clampCatalogPageSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(Math.round(n), 5), 50);
}

/** Mobile-readable app settings (authenticated users). */
router.get("/app", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getSystemConfig();
    const maxPdfSizeMb = Number(config.maxPdfSizeMb);
    res.json({
      catalogPageSize: clampCatalogPageSize(config.catalogPageSize),
      maxPdfSizeMb: Number.isFinite(maxPdfSizeMb) && maxPdfSizeMb > 0 ? maxPdfSizeMb : 25,
      allowInAppCopyBorrow: config.allowInAppCopyBorrow === true,
      // Default true when unset so existing deployments keep librarian borrow allowed
      librariansCanBorrow: config.librariansCanBorrow !== false,
    });
  } catch (error) {
    console.error("App config read error:", error);
    res.status(500).json({ error: "Failed to read app config" });
  }
});

export default router;
