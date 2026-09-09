// naam/email se initials avatar
type Props = {
  name?: string;
  email?: string;
};

export function Avatar({ name, email }: Props) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] || ""}${parts[1]![0] || ""}`.toUpperCase()
      : source.slice(0, 2).toUpperCase();

  return (
    <span className="avatar" aria-hidden>
      {initials || "?"}
    </span>
  );
}
