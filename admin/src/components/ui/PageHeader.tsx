import type { ReactNode } from "react";

// page ka intro header - title optional hai kyunke top bar pe naam pehle se hai
type Props = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className={`page-header${title ? "" : " page-header-intro"}`}>
      <div>
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
