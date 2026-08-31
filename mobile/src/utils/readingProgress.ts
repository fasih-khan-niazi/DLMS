/** Minimum time on a page before it counts toward reading progress. */
export const MIN_PAGE_DWELL_MS = 4000;

export type ReadingProgressSnapshot = {
  progress: number;
  lastPage: number;
  totalPages: number;
};

/**
 * Tracks meaningful reading. Rapid scroll-to-end does not instantly hit 100%.
 * A page counts only after the reader stays on it for MIN_PAGE_DWELL_MS.
 * Prior saved progress is preserved and can only increase.
 */
export class ReadingProgressTracker {
  private currentPage = 1;
  private totalPages = 1;
  private pageEnteredAt = Date.now();
  private readPages = new Set<number>();
  private floorProgress = 0;

  constructor(initial?: Partial<ReadingProgressSnapshot> & { progress?: number }) {
    if (initial?.lastPage && initial.lastPage > 1) {
      this.currentPage = initial.lastPage;
    }
    if (initial?.totalPages && initial.totalPages > 0) {
      this.totalPages = initial.totalPages;
    }
    this.floorProgress = Math.min(100, Math.max(0, Number(initial?.progress ?? 0)));
    if (this.totalPages > 1 && this.floorProgress > 0) {
      const seeded = Math.floor((this.floorProgress / 100) * this.totalPages);
      for (let i = 1; i <= seeded; i++) {
        this.readPages.add(i);
      }
    }
  }

  onPageChange(nextPage: number, totalPages: number) {
    this.commitCurrentPageDwell();
    this.currentPage = Math.max(1, nextPage);
    this.totalPages = Math.max(1, totalPages);
    this.pageEnteredAt = Date.now();
  }

  onPause() {
    this.commitCurrentPageDwell();
  }

  private commitCurrentPageDwell() {
    const dwell = Date.now() - this.pageEnteredAt;
    if (dwell >= MIN_PAGE_DWELL_MS && this.currentPage >= 1) {
      this.readPages.add(this.currentPage);
    }
  }

  getSnapshot(): ReadingProgressSnapshot {
    this.commitCurrentPageDwell();
    const pagesRead = new Set(this.readPages);
    if (Date.now() - this.pageEnteredAt >= MIN_PAGE_DWELL_MS) {
      pagesRead.add(this.currentPage);
    }
    const calculated = Math.min(
      100,
      Math.round((pagesRead.size / Math.max(this.totalPages, 1)) * 100)
    );
    const progress = Math.max(this.floorProgress, calculated);
    return {
      progress,
      lastPage: this.currentPage,
      totalPages: this.totalPages,
    };
  }
}
