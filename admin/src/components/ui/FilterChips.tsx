type Chip = {
  id: string;
  label: string;
};

type Props = {
  chips: Chip[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

export function FilterChips({ chips, value, onChange, ariaLabel }: Props) {
  return (
    <div className="filter-chips" role="group" aria-label={ariaLabel || "Filters"}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={value === chip.id ? "filter-chip active" : "filter-chip"}
          aria-pressed={value === chip.id}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
