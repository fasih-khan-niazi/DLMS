/**
 * Idempotent seed: system config, holidays, and a catalog of real books + copies.
 * Does NOT create users (you already have accounts).
 *
 * From project root: npm run seed
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const DEFAULT_SA = path.resolve(
  __dirname,
  "../secrets/dlms-b7390-firebase-adminsdk-fbsvc-9468ed8000.json"
);
const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_SA
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account not found: ${serviceAccountPath}`);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccountPath) });
}

const db = getFirestore();

type SeedBook = {
  isbn: string;
  title: string;
  authors: string[];
  description: string;
  categories: string[];
  publishedDate: string;
  pageCount: number;
  publisher: string;
  thumbnailUrl: string;
  copies: number;
};

/** Well-known titles with stable ISBNs for a believable demo catalog. */
const BOOKS: SeedBook[] = [
  {
    isbn: "9780141439518",
    title: "Pride and Prejudice",
    authors: ["Jane Austen"],
    description:
      "Elizabeth Bennet navigates manners, upbringing, morality, and marriage in Georgian England.",
    categories: ["Fiction", "Classics", "Romance"],
    publishedDate: "1813",
    pageCount: 480,
    publisher: "Penguin Classics",
    thumbnailUrl: "https://books.google.com/books/content?id=s1gVAAAAYAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 3,
  },
  {
    isbn: "9780451524935",
    title: "1984",
    authors: ["George Orwell"],
    description:
      "A dystopian novel about totalitarianism, surveillance, and the rewriting of truth.",
    categories: ["Fiction", "Classics", "Dystopian"],
    publishedDate: "1949",
    pageCount: 328,
    publisher: "Signet Classic",
    thumbnailUrl: "https://books.google.com/books/content?id=kakvlOMV2uYC&printsec=frontcover&img=1&zoom=1",
    copies: 3,
  },
  {
    isbn: "9780141036144",
    title: "Animal Farm",
    authors: ["George Orwell"],
    description:
      "A political allegory in which farm animals overthrow their human farmer, then face a new tyranny.",
    categories: ["Fiction", "Classics", "Satire"],
    publishedDate: "1945",
    pageCount: 112,
    publisher: "Penguin",
    thumbnailUrl: "https://books.google.com/books/content?id=1YkQywEACAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780743273565",
    title: "The Great Gatsby",
    authors: ["F. Scott Fitzgerald"],
    description:
      "Jay Gatsby's pursuit of Daisy Buchanan against the backdrop of Jazz Age wealth and illusion.",
    categories: ["Fiction", "Classics"],
    publishedDate: "1925",
    pageCount: 180,
    publisher: "Scribner",
    thumbnailUrl: "https://books.google.com/books/content?id=iXn5U2Sz8SQC&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780061120084",
    title: "To Kill a Mockingbird",
    authors: ["Harper Lee"],
    description:
      "Scout Finch recalls her childhood in Alabama and her father's defense of a Black man falsely accused.",
    categories: ["Fiction", "Classics"],
    publishedDate: "1960",
    pageCount: 336,
    publisher: "Harper Perennial",
    thumbnailUrl: "https://books.google.com/books/content?id=PGR2AwAAQBAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780547928227",
    title: "The Hobbit",
    authors: ["J. R. R. Tolkien"],
    description:
      "Bilbo Baggins joins dwarves on a quest to reclaim a treasure guarded by the dragon Smaug.",
    categories: ["Fiction", "Fantasy"],
    publishedDate: "1937",
    pageCount: 300,
    publisher: "Houghton Mifflin Harcourt",
    thumbnailUrl: "https://books.google.com/books/content?id=llV9BAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780140449266",
    title: "Crime and Punishment",
    authors: ["Fyodor Dostoyevsky"],
    description:
      "A poverty-stricken student commits a murder and wrestles with guilt, ideology, and redemption.",
    categories: ["Fiction", "Classics"],
    publishedDate: "1866",
    pageCount: 671,
    publisher: "Penguin Classics",
    thumbnailUrl: "https://books.google.com/books/content?id=AAuGQgAACAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780140449136",
    title: "The Odyssey",
    authors: ["Homer"],
    description:
      "Odysseus's long journey home after the Trojan War, through monsters, gods, and temptation.",
    categories: ["Poetry", "Classics", "Mythology"],
    publishedDate: "800",
    pageCount: 541,
    publisher: "Penguin Classics",
    thumbnailUrl: "https://books.google.com/books/content?id=2iYqAAAAYAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780141187761",
    title: "Brave New World",
    authors: ["Aldous Huxley"],
    description:
      "A futuristic society engineered for stability confronts freedom, individuality, and discontent.",
    categories: ["Fiction", "Classics", "Dystopian"],
    publishedDate: "1932",
    pageCount: 288,
    publisher: "Penguin",
    thumbnailUrl: "https://books.google.com/books/content?id=5Z9cPgAACAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780140449181",
    title: "Frankenstein",
    authors: ["Mary Shelley"],
    description:
      "Victor Frankenstein creates life and faces the moral cost of scientific ambition.",
    categories: ["Fiction", "Classics", "Gothic"],
    publishedDate: "1818",
    pageCount: 273,
    publisher: "Penguin Classics",
    thumbnailUrl: "https://books.google.com/books/content?id=2ygGtwAACAAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780199535569",
    title: "The Adventures of Sherlock Holmes",
    authors: ["Arthur Conan Doyle"],
    description:
      "Twelve short stories featuring Sherlock Holmes and Dr Watson solving cases in Victorian London.",
    categories: ["Fiction", "Mystery", "Classics"],
    publishedDate: "1892",
    pageCount: 368,
    publisher: "Oxford University Press",
    thumbnailUrl: "https://books.google.com/books/content?id=VVwvAAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    copies: 2,
  },
  {
    isbn: "9780140449273",
    title: "Anna Karenina",
    authors: ["Leo Tolstoy"],
    description:
      "A tragedy of love, family, and society in nineteenth-century Russia.",
    categories: ["Fiction", "Classics"],
    publishedDate: "1878",
    pageCount: 864,
    publisher: "Penguin Classics",
    thumbnailUrl: "https://books.google.com/books/content?id=b0g9EAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    copies: 1,
  },
];

function buildSearchKeywords(input: {
  title: string;
  authors: string[];
  isbn: string;
  categories?: string[];
}): string[] {
  const raw = [input.title, ...input.authors, input.isbn, ...(input.categories || [])]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return Array.from(new Set(raw));
}

async function refreshCopyCounts(isbn: string) {
  const copiesSnap = await db.collection("bookCopies").where("isbn", "==", isbn).get();
  let available = 0;
  let issued = 0;
  let reserved = 0;
  let damaged = 0;
  copiesSnap.docs.forEach((doc) => {
    const status = doc.data().status;
    if (status === "available") available += 1;
    else if (status === "issued") issued += 1;
    else if (status === "reserved") reserved += 1;
    else if (status === "damaged") damaged += 1;
  });
  await db
    .collection("catalog")
    .doc(isbn)
    .set(
      {
        totalCopies: copiesSnap.size,
        availableCount: available,
        issuedCount: issued,
        reservedCount: reserved,
        damagedCount: damaged,
        updatedAt: new Date(),
      },
      { merge: true }
    );
}

async function seedBook(book: SeedBook) {
  const catalogRef = db.collection("catalog").doc(book.isbn);
  const existing = await catalogRef.get();
  const now = new Date();

  if (!existing.exists) {
    await catalogRef.set({
      isbn: book.isbn,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      publishedDate: book.publishedDate,
      description: book.description,
      thumbnailUrl: book.thumbnailUrl,
      categories: book.categories,
      pageCount: book.pageCount,
      searchKeywords: buildSearchKeywords({
        title: book.title,
        authors: book.authors,
        isbn: book.isbn,
        categories: book.categories,
      }),
      source: "seed",
      isActive: true,
      totalCopies: 0,
      availableCount: 0,
      issuedCount: 0,
      reservedCount: 0,
      damagedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  + ${book.title}`);
  } else {
    // Refresh metadata for nicer covers/descriptions without wiping live counts
    await catalogRef.set(
      {
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        publishedDate: book.publishedDate,
        description: book.description,
        thumbnailUrl: book.thumbnailUrl || existing.data()?.thumbnailUrl || "",
        categories: book.categories,
        pageCount: book.pageCount,
        searchKeywords: buildSearchKeywords({
          title: book.title,
          authors: book.authors,
          isbn: book.isbn,
          categories: book.categories,
        }),
        updatedAt: now,
      },
      { merge: true }
    );
    console.log(`  ~ ${book.title} (metadata refreshed)`);
  }

  for (let i = 1; i <= book.copies; i += 1) {
    const n = String(i).padStart(2, "0");
    const copyId = `cpy_seed_${book.isbn.slice(-6)}_${n}`;
    const copyRef = db.collection("bookCopies").doc(copyId);
    const copySnap = await copyRef.get();
    if (copySnap.exists) {
      continue;
    }
    const qrPayload = `${copyId}_${book.isbn}`;
    await copyRef.set({
      copyId,
      isbn: book.isbn,
      title: book.title,
      authors: book.authors,
      barcode: `SEED-${book.isbn.slice(-6)}-${n}`,
      qrPayload,
      status: "available",
      currentLoanId: null,
      reservedForUserId: null,
      readyAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`      copy ${copyId}`);
  }

  await refreshCopyCounts(book.isbn);
}

async function seed() {
  console.log("Seeding DLMS catalog (no users)...\n");

  console.log("1) System config");
  await db.collection("config").doc("system").set(
    {
      timezone: "Asia/Karachi",
      maxBorrowLimit: 5,
      loanPeriodDays: 14,
      finePerDayRs: 50,
      reservationHoldHours: 72,
      blockCheckoutIfUnpaidFine: true,
      reminderDaysBefore: [2, 1],
      workingDaysOff: ["Sunday"],
      maxPdfSizeMb: 25,
      librariansCanBorrow: true,
      updatedAt: new Date(),
    },
    { merge: true }
  );
  console.log("  config/system upserted");

  console.log("\n2) Holidays");
  const holidays = [
    { date: "2026-03-23", name: "Pakistan Day" },
    { date: "2026-08-14", name: "Independence Day" },
  ];
  for (const h of holidays) {
    await db.collection("config").doc("holidays").collection("dates").doc(h.date).set({
      name: h.name,
      date: h.date,
    });
    console.log(`  ${h.date} ${h.name}`);
  }

  console.log(`\n3) Catalog (${BOOKS.length} titles)`);
  for (const book of BOOKS) {
    await seedBook(book);
  }

  const totalCopies = BOOKS.reduce((sum, b) => sum + b.copies, 0);
  console.log(`\nSeed complete: ${BOOKS.length} books, up to ${totalCopies} physical copies.`);
  console.log("Users were not touched. Re-run anytime; existing copies are skipped.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
