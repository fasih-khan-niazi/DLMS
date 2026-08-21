import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";

export function ForgotPasswordPage() {
  const location = useLocation();
  const preset = (location.state as { email?: string } | null)?.email || "";
  const [email, setEmail] = useState(preset);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter the email on your admin account.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, trimmed);
      setSent(true);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/user-not-found") {
        setError("No account found for that email.");
      } else if (code === "auth/invalid-email") {
        setError("That email address looks invalid.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Could not send reset email. Check Firebase Auth email settings.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <p className="auth-eyebrow">Account recovery</p>
        <h1 className="auth-brand">DLMS</h1>
        <p className="auth-lede">
          Firebase emails a secure password reset link. Open it, set a new password,
          then sign in again.
        </p>
      </div>

      <form className="auth-panel" onSubmit={(e) => void onSubmit(e)}>
        <h2>Forgot password</h2>
        {sent ? (
          <>
            <p className="success-banner">
              If an account exists for {email.trim()}, a reset link is on its way.
              Check inbox and spam, then return to sign in.
            </p>
            <Link className="btn btn-primary btn-block" to="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              Uses Firebase Auth email link (not a custom OTP). Configure the email
              template under Firebase Console Authentication.
            </p>
            {error ? <p className="error-banner">{error}</p> : null}
            <label>
              Account email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Sending..." : "Send reset link"}
            </button>
            <div className="auth-row center">
              <Link className="auth-link" to="/login">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
