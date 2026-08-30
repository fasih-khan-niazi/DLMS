/**
 * Phase X verification harness.
 *
 * Read-only audit of the live Firestore data plus an optional reconcile pass.
 * Proves the invariants Phase 16 depends on:
 *   - catalog counters match live copy statuses
 *   - nobody is waiting while a copy of that title sits available
 *   - no copy is `reserved` without a matching `ready` reservation
 *   - config booleans are stored as real booleans
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-phase-x.ts            audit only
 *   npx tsx scripts/verify-phase-x.ts --reconcile audit, reconcile, re-audit
 */
import { db } from "../api/src/config/firebase";
import {
  normalizeIsbn,
  reconcileAllWaitingQueues,
} from "../api/src/services/reservations";

const BOOLEAN_CONFIG_FIELDS = [
  "blockCheckoutIfUnpaidFine",
  "librariansCanBorrow",
  "allowInAppCopyBorrow",
] as const;

type Finding = { severity: "FAIL" | "WARN"; message: string };

async function auditConfig(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const snap = await db.collection("config").doc("system").get();

  if (!snap.exists) {
    findings.push({ severity: "FAIL", message: "config/system document is missing" });
    return findings;
  }

  const data = snap.data()!;
  console.log("\n--- System config ---");
  for (const field of BOOLEAN_CONFIG_FIELDS) {
    const value = data[field];
    const kind = value === undefined ? "unset" : typeof value;
    console.log(`  ${field}: ${String(value)} (${kind})`);

    if (value !== undefined && typeof value !== "boolean") {
      findings.push({
        severity: "FAIL",
        message: `config.${field} is stored as ${kind} (${String(value)}), expected boolean`,
      });
    }
  }
  console.log(`  reservationHoldHours: ${data.reservationHoldHours}`);
  console.log(`  maxBorrowLimit: ${data.maxBorrowLimit}, loanPeriodDays: ${data.loanPeriodDays}`);

  return findings;
}

type CopyRow = { id: string; status?: string; reservedForUserId?: string; isbn?: string };

async function auditCirculation(): Promise<Finding[]> {
  const findings: Finding[] = [];

  const [catalogSnap, copiesSnap, reservationsSnap] = await Promise.all([
    db.collection("catalog").get(),
    db.collection("bookCopies").get(),
    db.collection("reservations").get(),
  ]);

  const copiesByIsbn = new Map<string, CopyRow[]>();
  for (const doc of copiesSnap.docs) {
    const data = doc.data();
    const isbn = normalizeIsbn(String(data.isbn || ""));
    if (!isbn) {
      findings.push({ severity: "WARN", message: `copy ${doc.id} has no ISBN` });
      continue;
    }
    const list = copiesByIsbn.get(isbn) || [];
    list.push({ id: doc.id, ...data } as CopyRow);
    copiesByIsbn.set(isbn, list);
  }

  const waitingByIsbn = new Map<string, number>();
  const readyRows: Array<{ id: string; isbn: string; userId: string; copyId: string }> = [];
  for (const doc of reservationsSnap.docs) {
    const data = doc.data();
    const isbn = normalizeIsbn(String(data.isbn || ""));
    if (data.status === "waiting") {
      waitingByIsbn.set(isbn, (waitingByIsbn.get(isbn) || 0) + 1);
    } else if (data.status === "ready") {
      readyRows.push({
        id: doc.id,
        isbn,
        userId: String(data.userId || ""),
        copyId: String(data.assignedCopyId || ""),
      });
    }
  }

  console.log("\n--- Circulation integrity ---");
  console.log(
    `  ${catalogSnap.size} titles, ${copiesSnap.size} copies, ${reservationsSnap.size} reservations`
  );

  // 1. Counter drift: stored counters vs live copy statuses.
  let driftCount = 0;
  for (const doc of catalogSnap.docs) {
    const isbn = normalizeIsbn(doc.id);
    const copies = copiesByIsbn.get(isbn) || [];
    const live = { available: 0, issued: 0, reserved: 0 };
    for (const copy of copies) {
      if (copy.status === "available") live.available += 1;
      else if (copy.status === "issued") live.issued += 1;
      else if (copy.status === "reserved") live.reserved += 1;
    }

    const data = doc.data();
    const stored = {
      available: Number(data.availableCount || 0),
      issued: Number(data.issuedCount || 0),
      reserved: Number(data.reservedCount || 0),
    };

    if (
      stored.available !== live.available ||
      stored.issued !== live.issued ||
      stored.reserved !== live.reserved
    ) {
      driftCount += 1;
      findings.push({
        severity: "FAIL",
        message:
          `counter drift on ${isbn} (${data.title || "?"}): ` +
          `stored a=${stored.available}/i=${stored.issued}/r=${stored.reserved} vs ` +
          `live a=${live.available}/i=${live.issued}/r=${live.reserved}`,
      });
    }
  }
  console.log(`  counter drift: ${driftCount} title(s)`);

  // 2. Someone waiting while a copy of that title is free (the Phase R symptom).
  let starvedQueues = 0;
  for (const [isbn, waiting] of waitingByIsbn) {
    if (waiting === 0) continue;
    const copies = copiesByIsbn.get(isbn) || [];
    const freeCopies = copies.filter((c) => c.status === "available").length;
    if (freeCopies > 0) {
      starvedQueues += 1;
      findings.push({
        severity: "FAIL",
        message:
          `${waiting} reader(s) waiting on ${isbn} while ${freeCopies} copy(ies) sit available ` +
          `(return did not promote the queue)`,
      });
    }
  }
  console.log(`  starved queues: ${starvedQueues}`);

  // 3. Reserved copies with no matching ready reservation.
  let orphanReserved = 0;
  for (const [isbn, copies] of copiesByIsbn) {
    for (const copy of copies) {
      if (copy.status !== "reserved") continue;
      const match = readyRows.find(
        (r) =>
          r.copyId === copy.id &&
          (!copy.reservedForUserId || r.userId === copy.reservedForUserId)
      );
      if (!match) {
        orphanReserved += 1;
        findings.push({
          severity: "FAIL",
          message: `copy ${copy.id} (${isbn}) is reserved but has no matching ready reservation`,
        });
      }
    }
  }
  console.log(`  orphan reserved copies: ${orphanReserved}`);

  // 4. Ready reservations pointing at a copy that is not held for them.
  let brokenReady = 0;
  for (const row of readyRows) {
    if (!row.copyId) {
      brokenReady += 1;
      findings.push({
        severity: "FAIL",
        message: `ready reservation ${row.id} (${row.isbn}) has no assignedCopyId`,
      });
      continue;
    }
    const copy = (copiesByIsbn.get(row.isbn) || []).find((c) => c.id === row.copyId);
    if (!copy) {
      brokenReady += 1;
      findings.push({
        severity: "FAIL",
        message: `ready reservation ${row.id} points at missing copy ${row.copyId}`,
      });
    } else if (copy.status !== "reserved" || copy.reservedForUserId !== row.userId) {
      brokenReady += 1;
      findings.push({
        severity: "FAIL",
        message:
          `ready reservation ${row.id} claims copy ${row.copyId} but copy is ` +
          `status=${copy.status} heldFor=${copy.reservedForUserId || "none"}`,
      });
    }
  }
  console.log(`  broken ready holds: ${brokenReady}`);

  // 5. Issued copies must point at an active loan.
  const loansSnap = await db.collection("loans").where("status", "==", "active").get();
  const activeLoanIds = new Set(loansSnap.docs.map((d) => d.id));
  let brokenIssued = 0;
  for (const [, copies] of copiesByIsbn) {
    for (const copy of copies) {
      if (copy.status !== "issued") continue;
      const loanId = String((copy as any).currentLoanId || "");
      if (!loanId || !activeLoanIds.has(loanId)) {
        brokenIssued += 1;
        findings.push({
          severity: "FAIL",
          message:
            `copy ${copy.id} is issued but currentLoanId ${loanId || "(none)"} ` +
            `is not an active loan (copy can never be returned or shelved)`,
        });
      }
    }
  }
  console.log(`  issued copies without an active loan: ${brokenIssued}`);

  return findings;
}

function report(label: string, findings: Finding[]) {
  console.log(`\n=== ${label} ===`);
  if (findings.length === 0) {
    console.log("  PASS: no issues found");
    return;
  }
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.message}`);
  }
}

async function main() {
  const shouldReconcile = process.argv.includes("--reconcile");

  console.log("DLMS Phase X verification");
  console.log("=========================");

  const before = [...(await auditConfig()), ...(await auditCirculation())];
  report("Audit (before)", before);

  if (!shouldReconcile) {
    process.exit(before.some((f) => f.severity === "FAIL") ? 1 : 0);
  }

  console.log("\n--- Running reconcileAllWaitingQueues() ---");
  const result = await reconcileAllWaitingQueues();
  console.log(`  ${JSON.stringify(result)}`);

  const after = await auditCirculation();
  report("Audit (after reconcile)", after);

  const fixed = before.filter((f) => f.severity === "FAIL").length -
    after.filter((f) => f.severity === "FAIL").length;
  console.log(`\nNet failures resolved by reconcile: ${fixed}`);

  process.exit(after.some((f) => f.severity === "FAIL") ? 1 : 0);
}

main().catch((error) => {
  console.error("Verification crashed:", error);
  process.exit(2);
});
