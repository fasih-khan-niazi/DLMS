import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, profile, loading, error, login, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && profile) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // error via context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <p className="auth-eyebrow">Library operations</p>
        <h1 className="auth-brand">DLMS</h1>
        <p className="auth-lede">
          Admin console for users, config, fines, reservations, and reports.
        </p>
      </div>

      <form className="auth-panel" onSubmit={(e) => void onSubmit(e)}>
        <h2>Sign in</h2>
        <p className="muted">Admin accounts only. Librarians use the mobile app.</p>
        {error ? <p className="error-banner">{error}</p> : null}

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <div className="auth-row">
          <Link className="auth-link" to="/forgot-password" state={{ email: email.trim() }}>
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting || loading}
        >
          {submitting || loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
