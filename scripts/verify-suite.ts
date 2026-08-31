/**
 * Runs the QA scripts in order and reports a combined scorecard.
 *
 * Read-only / math checks first, then HTTP config, then mutating circulation
 * flows so a failure early does not leave the library mid-borrow.
 *
 * Usage (from repo root):
 *   npm run verify:suite
 *   npx tsx scripts/verify-suite.ts [apiBaseUrl]
 */
import { spawnSync } from "child_process";
import path from "path";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");

const STEPS: Array<{ name: string; file: string; args?: boolean }> = [
  { name: "phase-x audit", file: "verify-phase-x.ts" },
  { name: "due / fines / holidays", file: "verify-due-fines.ts" },
  { name: "digital covers", file: "verify-digital-covers.ts", args: true },
  { name: "notification dedupe", file: "verify-notifications.ts" },
  { name: "admin config HTTP", file: "verify-config-http.ts", args: true },
  { name: "librarian gates", file: "verify-librarian-gates.ts", args: true },
  { name: "ready-hold cancel", file: "verify-ready-cancel.ts", args: true },
  { name: "circulation flow", file: "verify-circulation-flow.ts", args: true },
  { name: "return copy match", file: "verify-return-copy.ts", args: true },
];

function runStep(step: (typeof STEPS)[number]): { ok: boolean; code: number } {
  const script = path.join(__dirname, step.file);
  const args = ["tsx", script];
  if (step.args) args.push(API_BASE);

  console.log(`\n\n######## ${step.name} ########\n`);
  const result = spawnSync("npx", args, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const code = result.status ?? 1;
  return { ok: code === 0, code };
}

function main() {
  console.log(`DLMS QA suite against ${API_BASE}`);
  console.log("================================");

  const results: Array<{ name: string; ok: boolean; code: number }> = [];
  for (const step of STEPS) {
    results.push({ name: step.name, ...runStep(step) });
  }

  console.log("\n\n======== SCORECARD ========");
  for (const row of results) {
    console.log(`  ${row.ok ? "PASS" : "FAIL"}  ${row.name} (exit ${row.code})`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0 ? `\nALL ${results.length} SUITES PASSED` : `\n${failed}/${results.length} SUITE(S) FAILED`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
