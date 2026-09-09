import type { ReactNode } from "react";

// empty list ka placeholder - optional action button
type Props = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: Props) {
  return (
    <div className="empty-state">
      <h3 className="empty-state-title">{title}</h3>
      {message ? <p className="muted empty-state-message">{message}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
