type Props = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function Pagination({ page, totalPages, total, onPageChange, disabled }: Props) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="pagination-meta muted small">
        Showing {total} {total === 1 ? "result" : "results"}
      </p>
    ) : null;
  }

  return (
    <div className="pagination">
      <p className="pagination-meta muted small">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-small"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
