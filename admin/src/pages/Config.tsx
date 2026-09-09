// system config tabs + holidays management
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";
import { ConfirmDialog, PageHeader, ToggleSwitch, useToast } from "../components/ui";
import { extractApiError } from "../utils/apiError";

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

type ConfigTab = "loans" | "fines" | "reservations" | "calendar" | "catalog" | "digital";

const TABS: { id: ConfigTab; label: string }[] = [
  { id: "loans", label: "Loans" },
  { id: "fines", label: "Fines" },
  { id: "reservations", label: "Reservations" },
  { id: "calendar", label: "Calendar" },
  { id: "catalog", label: "Catalog" },
  { id: "digital", label: "Digital" },
];

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

const FIELD_LABELS: Record<string, string> = {
  allowInAppCopyBorrow: "Allow in-app copy borrow/return",
  librariansCanBorrow: "Librarians can borrow physical books",
  blockCheckoutIfUnpaidFine: "Block new borrows and reservations while unpaid fines exist",
  catalogPageSize: "Catalog page size",
  maxPdfSizeMb: "Max PDF size",
  reservationHoldHours: "Reservation hold hours",
};

function labelFor(field: string) {
  return FIELD_LABELS[field] || field;
}

const TIMEZONE_OPTIONS = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "UTC",
  "Europe/London",
  "America/New_York",
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const TOGGLE_FIELDS = ["allowInAppCopyBorrow", "librariansCanBorrow"] as const;

export function ConfigPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<ConfigTab>("loans");
  const [form, setForm] = useState<SystemConfig>(defaults);
  const [reminderText, setReminderText] = useState("2,1");
  const [daysOff, setDaysOff] = useState<string[]>(["Sunday"]);
  const [customTimezone, setCustomTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [deleteHoliday, setDeleteHoliday] = useState<{ date: string; name: string } | null>(
    null
  );

  // holidays list load
  async function loadHolidays() {
    try {
      const { data } = await api.get<{ holidays: Array<{ date: string; name: string }> }>(
        "/api/admin/holidays"
      );
      setHolidays(data.holidays || []);
    } catch (err) {
      showToast(extractApiError(err, "Failed to load holidays"), "error");
    }
  }

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
          setDaysOff(cfg.workingDaysOff || ["Sunday"]);
          if (cfg.timezone && !TIMEZONE_OPTIONS.includes(cfg.timezone)) {
            setCustomTimezone(cfg.timezone);
          }
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
        setDaysOff(cfg.workingDaysOff || ["Sunday"]);
        if (cfg.timezone && !TIMEZONE_OPTIONS.includes(cfg.timezone)) {
          setCustomTimezone(cfg.timezone);
        } else {
          setCustomTimezone("");
        }
        void loadHolidays();
      } catch (err) {
        if (!cancelled) {
          const msg = extractApiError(err, "Failed to load config");
          setError(msg);
          showToast(msg, "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  // naya holiday add
  async function addHoliday(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
      showToast("Holiday date must be YYYY-MM-DD", "error");
      return;
    }
    setHolidayBusy(true);
    try {
      await api.post("/api/admin/holidays", {
        date: holidayDate,
        name: holidayName.trim() || holidayDate,
      });
      showToast("Holiday saved", "success");
      setHolidayDate("");
      setHolidayName("");
      await loadHolidays();
    } catch (err) {
      showToast(extractApiError(err, "Failed to save holiday"), "error");
    } finally {
      setHolidayBusy(false);
    }
  }

  async function confirmDeleteHoliday() {
    if (!deleteHoliday) return;
    setHolidayBusy(true);
    try {
      await api.delete(`/api/admin/holidays/${deleteHoliday.date}`);
      showToast("Holiday removed", "success");
      setDeleteHoliday(null);
      await loadHolidays();
    } catch (err) {
      showToast(extractApiError(err, "Failed to delete holiday"), "error");
    } finally {
      setHolidayBusy(false);
    }
  }

  function updateNumber(field: keyof SystemConfig, value: string) {
    const n = Number(value);
    setForm((prev) => ({ ...prev, [field]: Number.isFinite(n) ? n : 0 }));
  }

  function validate(): string | null {
    if ((form.maxBorrowLimit ?? 0) < 1) return "Max borrow limit must be at least 1.";
    if ((form.loanPeriodDays ?? 0) < 1) return "Loan period must be at least 1 day.";
    if ((form.finePerDayRs ?? -1) < 0) return "Fine per day cannot be negative.";
    if ((form.reservationHoldHours ?? 0) < 1) {
      return "Reservation hold must be at least 1 hour.";
    }
    if ((form.maxPdfSizeMb ?? 0) < 1) return "Max PDF size must be at least 1 MB.";
    const pageSize = form.catalogPageSize ?? 10;
    if (pageSize < 5 || pageSize > 50) return "Catalog page size must be between 5 and 50.";
    const tz = (form.timezone || "").trim();
    if (!tz) return "Timezone is required.";
    if (!isValidIanaTimeZone(tz)) {
      return "Timezone must be a valid IANA name (example: Asia/Karachi).";
    }

    const reminders = reminderText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (reminders.length === 0) return "Enter at least one reminder day offset.";
    if (reminders.some((s) => !Number.isFinite(Number(s)) || Number(s) < 0)) {
      return "Reminder days must be non-negative numbers (example: 2,1).";
    }
    return null;
  }

  // config form save
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const reminderDaysBefore = reminderText
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));

      const payload = {
        maxBorrowLimit: form.maxBorrowLimit,
        loanPeriodDays: form.loanPeriodDays,
        finePerDayRs: form.finePerDayRs,
        reservationHoldHours: form.reservationHoldHours,
        blockCheckoutIfUnpaidFine: !!form.blockCheckoutIfUnpaidFine,
        reminderDaysBefore,
        workingDaysOff: daysOff,
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

      const applied = Array.isArray(data.appliedFields) ? data.appliedFields : null;
      const dropped = applied
        ? Object.keys(payload).filter((key) => !applied.includes(key))
        : [];

      setForm(cfg);
      sessionStorage.setItem("dlms.admin.config", JSON.stringify(cfg));

      if (dropped.length > 0) {
        setUnsupported(dropped);
        const msg =
          `Saved, but ${dropped.length} setting(s) were not applied: ` +
          `${dropped.map(labelFor).join(", ")}. Redeploy the API if this persists.`;
        setError(msg);
        showToast("Saved with partial support", "info");
      } else {
        setUnsupported([]);
        showToast("Configuration saved", "success");
      }
    } catch (err) {
      const msg = extractApiError(err, "Failed to save config");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader subtitle="Loading system settings..." />
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
      <PageHeader
        subtitle="Library rules for loans, fines, reservations, calendar, catalog, and digital uploads."
      />

      {error ? <p className="error-banner">{error}</p> : null}
      {unsupported.length > 0 ? (
        <p className="error-banner">
          Some settings are unavailable on this API build: {unsupported.map(labelFor).join(", ")}.
          Redeploy the latest API so those controls can be saved.
        </p>
      ) : null}

      <div className="config-tabs" role="tablist" aria-label="Configuration sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "config-tab active" : "config-tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form className="config-form config-form-tabbed" onSubmit={(e) => void onSubmit(e)}>
        {tab === "loans" ? (
          <section className="config-section" role="tabpanel">
            <div className="config-section-head">
              <h2>Loans</h2>
              <p className="muted small">Borrow limits, loan length, and who may borrow</p>
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
              <div className="config-span">
                <ToggleSwitch
                  checked={!!form.librariansCanBorrow}
                  onChange={(checked) =>
                    setForm((p) => ({ ...p, librariansCanBorrow: checked }))
                  }
                  label="Librarians can borrow physical books"
                  description="Off cancels librarian reservations and limits Scan to returns only."
                />
              </div>
              <div className="config-span">
                <ToggleSwitch
                  checked={!!form.allowInAppCopyBorrow}
                  disabled={unsupported.includes("allowInAppCopyBorrow")}
                  onChange={(checked) =>
                    setForm((p) => ({ ...p, allowInAppCopyBorrow: checked }))
                  }
                  label="Allow in-app copy borrow and return"
                  description={
                    unsupported.includes("allowInAppCopyBorrow")
                      ? "Unavailable on this API build. Scan remains the primary path."
                      : "Scan remains primary. Default is off."
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        {tab === "fines" ? (
          <section className="config-section" role="tabpanel">
            <div className="config-section-head">
              <h2>Fines</h2>
              <p className="muted small">
                Late charges. Returning a copy with an unpaid fine is always blocked until payment
                is recorded. The toggle below only controls new borrows and reservations.
              </p>
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
              <div className="config-span">
                <ToggleSwitch
                  checked={!!form.blockCheckoutIfUnpaidFine}
                  onChange={(checked) =>
                    setForm((p) => ({ ...p, blockCheckoutIfUnpaidFine: checked }))
                  }
                  label="Block new borrows and reservations while unpaid fines exist"
                  description="Off means readers can still borrow or reserve with a balance. They still cannot return a late copy until that fine is paid."
                />
              </div>
            </div>
          </section>
        ) : null}

        {tab === "reservations" ? (
          <section className="config-section" role="tabpanel">
            <div className="config-section-head">
              <h2>Reservations</h2>
              <p className="muted small">Hold window after a copy becomes ready for pickup</p>
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
        ) : null}

        {tab === "calendar" ? (
          <section className="config-section" role="tabpanel">
            <div className="config-section-head">
              <h2>Calendar and reminders</h2>
              <p className="muted small">Timezone, closed days, and due reminders</p>
            </div>
            <div className="config-grid">
              <label>
                Timezone
                <select
                  value={
                    TIMEZONE_OPTIONS.includes(form.timezone || "")
                      ? form.timezone
                      : "__custom__"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") {
                      setForm((p) => ({
                        ...p,
                        timezone: customTimezone || "Asia/Karachi",
                      }));
                      return;
                    }
                    setCustomTimezone("");
                    setForm((p) => ({ ...p, timezone: v }));
                  }}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                  <option value="__custom__">Other IANA…</option>
                </select>
              </label>
              {!TIMEZONE_OPTIONS.includes(form.timezone || "") || customTimezone ? (
                <label>
                  Custom IANA timezone
                  <input
                    type="text"
                    value={customTimezone || form.timezone || ""}
                    onChange={(e) => {
                      setCustomTimezone(e.target.value);
                      setForm((p) => ({ ...p, timezone: e.target.value }));
                    }}
                    placeholder="Asia/Karachi"
                  />
                  <span className="field-hint">Must be a valid IANA name</span>
                </label>
              ) : null}
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
              <div className="config-span">
                <p className="muted small" style={{ marginBottom: "0.5rem" }}>
                  Working days off
                </p>
                <div className="filter-chips" role="group" aria-label="Working days off">
                  {WEEKDAYS.map((day) => {
                    const active = daysOff.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={active ? "filter-chip active" : "filter-chip"}
                        aria-pressed={active}
                        onClick={() =>
                          setDaysOff((prev) =>
                            active ? prev.filter((d) => d !== day) : [...prev, day]
                          )
                        }
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <span className="field-hint">
                  Due dates roll forward past selected days and holidays
                </span>
              </div>
            </div>

            <div className="config-section-head" style={{ marginTop: "1.25rem" }}>
              <h2>Holidays</h2>
              <p className="muted small">
                Calendar dates that skip due dates (same collection the seed script uses)
              </p>
            </div>
            <form className="toolbar" onSubmit={addHoliday}>
              <label>
                Date
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="Pakistan Day"
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={holidayBusy}>
                {holidayBusy ? "Saving..." : "Add holiday"}
              </button>
            </form>
            <div className="table-wrap sticky-head" style={{ marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-cell">
                        No holidays configured.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h.date}>
                        <td className="mono">{h.date}</td>
                        <td>{h.name}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-small btn-danger-soft"
                            onClick={() => setDeleteHoliday(h)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "catalog" ? (
          <section className="config-section" role="tabpanel">
            <div className="config-section-head">
              <h2>Catalog</h2>
              <p className="muted small">How many titles appear per page in lists</p>
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
        ) : null}

        {tab === "digital" ? (
          <section className="config-section" role="tabpanel">
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
        ) : null}

        <div className="config-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save all settings"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={!!deleteHoliday}
        title="Remove this holiday?"
        message={
          deleteHoliday
            ? `${deleteHoliday.date} (${deleteHoliday.name}) will no longer skip due dates.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        busy={holidayBusy}
        onConfirm={() => void confirmDeleteHoliday()}
        onCancel={() => setDeleteHoliday(null)}
      />
    </div>
  );
}
