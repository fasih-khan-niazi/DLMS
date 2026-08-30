/**
 * Digital cover URLs on catalog list, detail, and bookshelf.
 *
 * Home "continue reading" was blank because /bookshelf/mine omitted thumbnailUrl.
 * This asserts the URL is attached and the cover endpoint answers.
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-digital-covers.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../api/src/config/firebase";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

async function client(uid: string): Promise<AxiosInstance> {
  const customToken = await auth.createCustomToken(uid);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${data.idToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });
}

function hasCoverUrl(row: { thumbnailUrl?: string; digitalBookId?: string }): boolean {
  const url = String(row.thumbnailUrl || "");
  const id = String(row.digitalBookId || "");
  return url.includes("/cover-image") && (!id || url.includes(id));
}

async function main() {
  console.log(`Digital cover URLs against ${API_BASE}`);
  console.log("=====================================");

  const users = await db.collection("users").where("role", "==", "student").limit(5).get();
  const student = users.docs.find((d) => d.data().isActive !== false);
  if (!student) throw new Error("No active student account found");

  const http = await client(student.id);
  console.log(`Student ${student.id}`);

  console.log(`\n1) GET /api/digital-books`);
  const list = await http.get("/api/digital-books", { params: { page: 1, pageSize: 10 } });
  if (list.status !== 200) {
    fail(`list returned ${list.status}`);
  } else {
    const results: Array<{ digitalBookId?: string; thumbnailUrl?: string }> = list.data.results || [];
    const missing = results.filter((row) => !hasCoverUrl(row));
    if (results.length === 0) {
      console.log("   (no digital titles â€” skip list cover check)");
    } else if (missing.length === 0) {
      pass(`${results.length} list row(s) include thumbnailUrl`);
    } else {
      fail(`${missing.length}/${results.length} list row(s) missing thumbnailUrl`);
    }
  }

  console.log(`\n2) GET /api/digital-books/bookshelf/mine`);
  const shelf = await http.get("/api/digital-books/bookshelf/mine");
  if (shelf.status !== 200) {
    fail(`bookshelf returned ${shelf.status}`);
  } else {
    const items: Array<{ digitalBookId?: string; thumbnailUrl?: string; progress?: number }> =
      shelf.data.items || [];
    const missing = items.filter((row) => !hasCoverUrl(row));
    if (items.length === 0) {
      console.log("   (empty bookshelf â€” Home continue-reading will be empty, which is fine)");
      pass("bookshelf endpoint is reachable");
    } else if (missing.length === 0) {
      pass(`${items.length} bookshelf item(s) include thumbnailUrl`);
    } else {
      fail(`${missing.length}/${items.length} bookshelf item(s) missing thumbnailUrl`);
    }
  }

  const digitalSnap = await db.collection("digitalBooks").limit(1).get();
  if (!digitalSnap.empty) {
    const digitalBookId = digitalSnap.docs[0].id;
    console.log(`\n3) GET /api/digital-books/${digitalBookId}/cover-image`);
    const cover = await http.get(`/api/digital-books/${digitalBookId}/cover-image`, {
      responseType: "arraybuffer",
    });
    const contentType = String(cover.headers["content-type"] || "");
    if (cover.status === 200 && contentType.startsWith("image/")) {
      pass(`cover-image ${cover.status} ${contentType} (${cover.data?.byteLength || 0} bytes)`);
    } else if (cover.status === 200) {
      pass(`cover-image 200 (${contentType || "no content-type"})`);
    } else {
      fail(`cover-image returned ${cover.status}`);
    }
  } else {
    console.log("\n3) No digitalBooks documents â€” skip cover-image fetch");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Digital-cover test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});
