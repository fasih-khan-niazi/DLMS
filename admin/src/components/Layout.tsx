import { useEffect, useMemo, useState, type ReactElement } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ConfirmDialog } from "./ui";
import { applyTheme, getStoredTheme, type ThemeMode } from "../utils/theme";

const navItems: Array<{
  to: string;
  label: string;
  end?: boolean;
  icon: () => ReactElement;
}> = [
  { to: "/", label: "Dashboard", end: true, icon: DashboardIcon },
  { to: "/users", label: "Users", icon: UsersIcon },
  { to: "/catalog", label: "Catalog", icon: CatalogIcon },
  { to: "/loans", label: "Loans", icon: LoansIcon },
  { to: "/config", label: "Config", icon: ConfigIcon },
  { to: "/reservations", label: "Reservations", icon: ReservationsIcon },
  { to: "/fines", label: "Fines", icon: FinesIcon },
  { to: "/reports", label: "Reports", icon: ReportsIcon },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/catalog": "Catalog",
  "/loans": "Loans",
  "/config": "Configuration",
  "/reservations": "Reservations",
  "/fines": "Fines",
  "/reports": "Reports",
};

const DENSITY_KEY = "dlms.admin.density";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 19c.4-1.8 1.6-2.8 3.5-2.8 1.2 0 2.2.4 2.9 1.2" />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  );
}

function LoansIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h9a2 2 0 0 1 2 2v13l-3-1.5L13 19l-3-1.5L7 19V6a2 2 0 0 1 2-2z" />
      <path d="M10 8h6M10 12h6" />
    </svg>
  );
}

function ConfigIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function ReservationsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="4" y="7" width="16" height="14" rx="2" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function FinesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5c.5-1 1.4-1.5 2.5-1.5s2 .6 2 1.8c0 2.2-4 1.4-4 3.7 0 1 .8 1.5 2 1.5s1.9-.4 2.4-1.2" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16V10M12 16V7M16 16v-4" />
    </svg>
  );
}

function getStoredDensity(): "comfortable" | "compact" {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function Layout() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [density, setDensity] = useState<"comfortable" | "compact">(() => getStoredDensity());

  const pageTitle = useMemo(() => {
    return PAGE_TITLES[location.pathname] || "Admin";
  }, [location.pathname]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      // ignore
    }
  }, [density]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      if (e.key === "/" ) {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[data-search="1"]'
        );
        search?.focus();
      }
      if (e.key === "Escape") {
        setSignOutOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setSignOutOpen(false);
    }
  }

  function onToggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <button
        type="button"
        className="shell-menu-btn"
        aria-label={navOpen ? "Close menu" : "Open menu"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {navOpen ? (
        <button
          type="button"
          className="shell-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">DLMS</span>
          <span className="brand-sub">Admin console</span>
        </div>
        <nav className="nav" aria-label="Main">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <span className="nav-icon" aria-hidden>
                  <Icon />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <p className="user-label">Signed in</p>
          <p className="user-email">{profile?.email}</p>
          <button type="button" className="btn btn-ghost" onClick={onToggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setDensity((d) => (d === "compact" ? "comfortable" : "compact"))
            }
          >
            {density === "compact" ? "Comfortable density" : "Compact density"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSignOutOpen(true)}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="shell-content">
        <header className="topbar">
          <div>
            <p className="topbar-crumb muted small">Admin / {pageTitle}</p>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <p className="topbar-hint muted small">Press / to focus search</p>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="You will need to sign in again to use the admin console."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        variant="danger"
        busy={signingOut}
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setSignOutOpen(false)}
      />
    </div>
  );
}
