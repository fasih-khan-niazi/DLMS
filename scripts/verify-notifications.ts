/**
 * Read-only inbox audit: the same user should not have two rows for the
 * same reservation/loan event (the old .add() path created twins).
 *
 * Usage (from repo root):
 *   npx tsx scripts/verify-notifications.ts
 */
import { db } from "../api/src/config/firebase";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

function eventKey(data: { type?: string; reservationId?: string; loanId?: string; userId?: string; sentAt?: { toDate?: () => Date } }): string | null {
  const type = String(data.type || "");
  const reservationId = String(data.reservationId || "");
  const loanId = String(data.loanId || "");
  if (reservationId && type) return `${data.userId}|${type}|rsv:${reservationId}`;
  if (loanId && type) {
    const sent = data.sentAt?.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
    const day = Number.isNaN(sent.getTime()) ? "" : sent.toISOString().slice(0, 10);
    return `${data.userId}|${type}|loan:${loanId}|${day}`;
  }
  return null;
}

async function main() {
  console.log("Notification inbox dedupe audit");
  console.log("===============================");

  const snap = await db.collection("notifications").get();
  const groups = new Map<string, string[]>();
  for (const doc of snap.docs) {
    const key = eventKey(doc.data());
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(doc.id);
    groups.set(key, list);
  }

  const twins = [...groups.entries()].filter(([, ids]) => ids.length > 1);
  const heal = process.argv.includes("--heal");
  console.log(`  ${snap.size} notification(s), ${groups.size} keyed event(s)`);
  if (twins.length === 0) {
    pass("no duplicate reservation/loan notices");
  } else if (heal) {
    for (const [key, ids] of twins) {
      const extras = ids.slice(1);
      for (const id of extras) {
        await db.collection("notifications").doc(id).delete();
      }
      console.log(`  healed ${extras.length} extra row(s) for ${key}`);
    }
    pass(`removed extras from ${twins.length} duplicate group(s)`);
  } else {
    for (const [key, ids] of twins.slice(0, 8)) {
      fail(`${ids.length} copies of ${key}`);
    }
    if (twins.length > 8) fail(`…and ${twins.length - 8} more duplicate groups`);
    console.log("  Re-run with --heal to keep one row per event and delete the extras.");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Notification audit crashed:", error?.message || error);
  process.exit(2);
});
