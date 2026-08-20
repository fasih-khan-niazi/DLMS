import { useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";

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
  timezone?: string;
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
  timezone: "Asia/Karachi",
};

export function ConfigPage() {
  const [form, setForm] = useState<SystemConfig>(defaults);
  const [reminderText, setReminderText] = useState("2,1");
  const [daysOffText, setDaysOffText] = useState("Sunday");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ config: SystemConfig }>("/api/admin/config");
        if (cancelled) return;
        const cfg = { ...defaults, ...data.config };
        setForm(cfg);
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
        timezone: form.timezone || "Asia/Karachi",
      };

      const { data } = await api.put<{ config: SystemConfig }>("/api/admin/config", payload);
      setForm({ ...defaults, ...data.config });
      setMessage("Config saved");
    } catch {
      setError("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Config</h1>
        <p className="muted">System settings for loans, fines, and digital uploads</p>
      </header>

      {message ? <p className="success-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <form className="config-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Max borrow limit
          <input
            type="number"
            value={form.maxBorrowLimit ?? 5}
            onChange={(e) => updateNumber("maxBorrowLimit", e.target.value)}
          />
        </label>
        <label>
          Loan period (days)
          <input
            type="number"
            value={form.loanPeriodDays ?? 14}
            onChange={(e) => updateNumber("loanPeriodDays", e.target.value)}
          />
        </label>
        <label>
          Fine per day (Rs)
          <input
            type="number"
            value={form.finePerDayRs ?? 50}
            onChange={(e) => updateNumber("finePerDayRs", e.target.value)}
          />
        </label>
        <label>
          Reservation hold (hours)
          <input
            type="number"
            value={form.reservationHoldHours ?? 72}
            onChange={(e) => updateNumber("reservationHoldHours", e.target.value)}
          />
        </label>
        <label>
          Reminder days before (comma-separated)
          <input
            type="text"
            value={reminderText}
            onChange={(e) => setReminderText(e.target.value)}
          />
        </label>
        <label>
          Working days off (comma-separated)
          <input
            type="text"
            value={daysOffText}
            onChange={(e) => setDaysOffText(e.target.value)}
          />
        </label>
        <label>
          Max PDF size (MB)
          <input
            type="number"
            value={form.maxPdfSizeMb ?? 25}
            onChange={(e) => updateNumber("maxPdfSizeMb", e.target.value)}
          />
        </label>
        <label>
          Timezone
          <input
            type="text"
            value={form.timezone || "Asia/Karachi"}
            onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={!!form.blockCheckoutIfUnpaidFine}
            onChange={(e) =>
              setForm((p) => ({ ...p, blockCheckoutIfUnpaidFine: e.target.checked }))
            }
          />
          Block checkout if unpaid fine
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={!!form.librariansCanBorrow}
            onChange={(e) =>
              setForm((p) => ({ ...p, librariansCanBorrow: e.target.checked }))
            }
          />
          Librarians can borrow
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save config"}
        </button>
      </form>
    </div>
  );
}
