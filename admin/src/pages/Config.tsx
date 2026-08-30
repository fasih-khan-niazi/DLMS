import { useEffect, useState, type FormEvent } from "react";
import { api, API_BASE_URL } from "../config/api";

type SystemConfig = {
  maxBorrowLimit?: number;
  loanPeriodDays?: number;
  finePerDayRs?: number;
  reservationHoldHours?: number;
  blockCheckoutIfUnpaidFine?: boolean;
  reminderDaysBefore?: number[] | number;
  workingDaysOff?: string[];
  maxPdfSizeMb?: number;
  librariansCanBorrow?: boolean;
  allowInAppCopyBorrow?: boolean;
  timezone?: string;
  catalogPageSize?: number;
};

const defaults: SystemConfig = {
  maxBorrowLimit: 5,
  loanPeriodDays: 14,
  finePerDayRs: 50,
  reservationHoldHours: 72,
  blockCheckoutIfUnpaidFine: true,
  reminderDaysBefore: [2, 1],
  workingDaysOff: ["Sunday"],
  maxPdfSizeMb: 25,
  librariansCanBorrow: true,
  allowInAppCopyBorrow: false,
  timezone: "Asia/Karachi",
  catalogPageSize: 10,
};

/** Human labels used when the connected API cannot store a setting. */
const FIELD_LABELS: Record<string, string> = {
  allowInAppCopyBorrow: "Allow in-app copy borrow/return",
  librariansCanBorrow: "Librarians can borrow physical books",
  blockCheckoutIfUnpaidFine: "Block checkout when fines unpaid",
  catalogPageSize: "Catalog page size",
  maxPdfSizeMb: "Max PDF size",
  reservationHoldHours: "Reservation hold hours",
};

function labelFor(field: string) {
  return FIELD_LABELS[field] || field;
}

/** Settings added after the Week 1 API; used to detect an outdated backend. */
const TOGGLE_FIELDS = ["allowInAppCopyBorrow", "librariansCanBorrow"] as const;

export function ConfigPage() {
  const [form, setForm] = useState<SystemConfig>(defaults);
  const [reminderText, setReminderText] = useState("2,1");
  const [daysOffText, setDaysOffText] = useState("Sunday");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = sessionStorage.getItem("dlms.admin.config");
        if (cached) {
          const cfg = { ...defaults, ...JSON.parse(cached) };
          setForm(cfg);
          const reminders = Array.isArray(cfg.reminderDaysBefore)
            ? cfg.reminderDaysBefore.join(",")
            : String(cfg.reminderDaysBefore ?? "2,1");
          setReminderText(reminders);
          setDaysOffText((cfg.workingDaysOff || ["Sunday"]).join(","));
          setLoading(false);
        }

        const { data } = await api.get<{
          config: SystemConfig;
          supportedFields?: string[];
        }>("/api/admin/config", {
          headers: { "Cache-Control": "no-cache" },
          params: { _t: Date.now() },
        });
        if (cancelled) return;
        const cfg: SystemConfig = {
          ...defaults,
          ...data.config,
          allowInAppCopyBorrow: data.config?.allowInAppCopyBorrow === true,
          librariansCanBorrow: data.config?.librariansCanBorrow !== false,
        };

        // An API that does not advertise a field cannot store it. Flag it now
        // rather than letting the control appear to save and then revert.
        if (Array.isArray(data.supportedFields)) {
          const missing = TOGGLE_FIELDS.filter((f) => !data.supportedFields!.includes(f));
          setUnsupported(missing);
        } else {
          setUnsupported([...TOGGLE_FIELDS]);
        }

        setForm(cfg);
        sessionStorage.setItem("dlms.admin.config", JSON.stringify(cfg));
        const reminders = Array.isArray(cfg.reminderDaysBefore)
          ? cfg.reminderDaysBefore.join(",")
          : String(cfg.reminderDaysBefore ?? "2,1");
        setReminderText(reminders);
        setDaysOffText((cfg.workingDaysOff || ["Sunday"]).join(","));
      } catch {
        if (!cancelled) setError("Failed to load config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateNumber(field: keyof SystemConfig, value: string) {
    const n = Number(value);
    setForm((prev) => ({ ...prev, [field]: Number.isFinite(n) ? n : 0 }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const reminderDaysBefore = reminderText
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      const workingDaysOff = daysOffText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        maxBorrowLimit: form.maxBorrowLimit,
        loanPeriodDays: form.loanPeriodDays,
        finePerDayRs: form.finePerDayRs,
        reservationHoldHours: form.reservationHoldHours,
        blockCheckoutIfUnpaidFine: !!form.blockCheckoutIfUnpaidFine,
        reminderDaysBefore,
        workingDaysOff,
        maxPdfSizeMb: form.maxPdfSizeMb,
        librariansCanBorrow: !!form.librariansCanBorrow,
        allowInAppCopyBorrow: !!form.allowInAppCopyBorrow,
        timezone: form.timezone || "Asia/Karachi",
        catalogPageSize: form.catalogPageSize,
      };

      const { data } = await api.put<{
        config: SystemConfig;
        appliedFields?: string[];
        supportedFields?: string[];
      }>("/api/admin/config", payload);

      const cfg: SystemConfig = {
        ...defaults,
        ...data.config,
        allowInAppCopyBorrow: data.config?.allowInAppCopyBorrow === true,
        librariansCanBorrow: data.config?.librariansCanBorrow !== false,
      };

      // Verify the server actually stored what we sent. Anything it did not
      // acknowledge is reported instead of silently snapping back.
      const applied = Array.isArray(data.appliedFields) ? data.appliedFields : null;
      const dropped = applied
        ? Object.keys(payload).filter((key) => !applied.includes(key))
        : [];

      setForm(cfg);
      sessionStorage.setItem("dlms.admin.config", JSON.stringify(cfg));

      if (dropped.length > 0) {
        setUnsupported(dropped);
        setError(
          `Saved, but this API rejected ${dropped.length} setting(s): ` +
            `${dropped.map(labelFor).join(", ")}. The API at ${API_BASE_URL} is older than this portal.`
        );
      } else {
        setUnsupported([]);
        setMessage("Configuration saved successfully.");
      }
    } catch {
      setError("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Configuration</h1>
          <p className="muted">Loading system settings...</p>
        </header>
        <div className="skeleton-stack">
          <div className="skeleton-block" />
          <div className="skeleton-block" />
          <div className="skeleton-block" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Configuration</h1>
        <p className="muted">
          Grouped system settings for loans, fines, reservations, calendar, and digital library.
        </p>
        <p className="muted small">Connected API: {API_BASE_URL}</p>
      </header>

      {message ? <p className="success-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {unsupported.length > 0 ? (
        <p className="error-banner">
          This API does not support {unsupported.map(labelFor).join(", ")}. Point the portal at an
          API that has these settings (set VITE_API_URL in admin/.env, then restart the dev server),
          or redeploy the API. Until then those controls cannot be saved.
        </p>
      ) : null}

      <form className="config-form config-form-sections" onSubmit={(e) => void onSubmit(e)}>
        <section className="config-section">
          <div className="config-section-head">
            <h2>Loans</h2>
            <p className="muted small">Borrow limits and loan duration</p>
          </div>
          <div className="config-grid">
            <label>
              Max borrow limit
              <input
                type="number"
                min={1}
                value={form.maxBorrowLimit ?? 5}
                onChange={(e) => updateNumber("maxBorrowLimit", e.target.value)}
              />
            </label>
            <label>
              Loan period (days)
              <input
                type="number"
                min={1}
                value={form.loanPeriodDays ?? 14}
                onChange={(e) => updateNumber("loanPeriodDays", e.target.value)}
              />
            </label>
            <label className="checkbox-row config-span">
              <input
                type="checkbox"
                checked={!!form.librariansCanBorrow}
                onChange={(e) =>
                  setForm((p) => ({ ...p, librariansCanBorrow: e.target.checked }))
                }
              />
              Librarians can borrow physical books
            </label>
            <label className="checkbox-row config-span">
              <input
                type="checkbox"
                checked={!!form.allowInAppCopyBorrow}
                disabled={unsupported.includes("allowInAppCopyBorrow")}
                onChange={(e) =>
                  setForm((p) => ({ ...p, allowInAppCopyBorrow: e.target.checked }))
                }
              />
              Allow in-app copy borrow/return (Scan remains primary; default off)
              {unsupported.includes("allowInAppCopyBorrow") ? (
                <span className="muted small"> — not supported by the connected API</span>
              ) : null}
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="config-section-head">
            <h2>Fines</h2>
            <p className="muted small">Late return charges and checkout blocking</p>
          </div>
          <div className="config-grid">
            <label>
              Fine per day (Rs)
              <input
                type="number"
                min={0}
                value={form.finePerDayRs ?? 50}
                onChange={(e) => updateNumber("finePerDayRs", e.target.value)}
              />
            </label>
            <label className="checkbox-row config-span">
              <input
                type="checkbox"
                checked={!!form.blockCheckoutIfUnpaidFine}
                onChange={(e) =>
                  setForm((p) => ({ ...p, blockCheckoutIfUnpaidFine: e.target.checked }))
                }
              />
              Block borrow and reserve while unpaid fines exist
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="config-section-head">
            <h2>Reservations</h2>
            <p className="muted small">Hold window after a copy becomes ready</p>
          </div>
          <div className="config-grid">
            <label>
              Reservation hold (hours)
              <input
                type="number"
                min={1}
                value={form.reservationHoldHours ?? 72}
                onChange={(e) => updateNumber("reservationHoldHours", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="config-section-head">
            <h2>Calendar and reminders</h2>
            <p className="muted small">Timezone, closed days, and due reminders</p>
          </div>
          <div className="config-grid">
            <label>
              Timezone
              <input
                type="text"
                value={form.timezone || "Asia/Karachi"}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              />
            </label>
            <label>
              Reminder days before due
              <input
                type="text"
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                placeholder="2,1"
              />
              <span className="field-hint">Comma-separated day offsets (example: 2,1)</span>
            </label>
            <label className="config-span">
              Working days off
              <input
                type="text"
                value={daysOffText}
                onChange={(e) => setDaysOffText(e.target.value)}
                placeholder="Sunday"
              />
              <span className="field-hint">Comma-separated weekday names</span>
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="config-section-head">
            <h2>Catalog</h2>
            <p className="muted small">How many titles appear per page in mobile and admin lists</p>
          </div>
          <div className="config-grid">
            <label>
              Books per page
              <input
                type="number"
                min={5}
                max={50}
                value={form.catalogPageSize ?? 10}
                onChange={(e) => updateNumber("catalogPageSize", e.target.value)}
              />
              <span className="field-hint">Between 5 and 50. Default is 10.</span>
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="config-section-head">
            <h2>Digital library</h2>
            <p className="muted small">Upload limits for PDF resources</p>
          </div>
          <div className="config-grid">
            <label>
              Max PDF size (MB)
              <input
                type="number"
                min={1}
                value={form.maxPdfSizeMb ?? 25}
                onChange={(e) => updateNumber("maxPdfSizeMb", e.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="config-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save all settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
