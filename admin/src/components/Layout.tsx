import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/users", label: "Users" },
  { to: "/config", label: "Config" },
  { to: "/reservations", label: "Reservations" },
  { to: "/fines", label: "Fines" },
  { to: "/reports", label: "Reports" },
];

export function Layout() {
  const { profile, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">DLMS</span>
          <span className="brand-sub">Admin</span>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="user-email">{profile?.email}</p>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
