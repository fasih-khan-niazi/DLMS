/** Deep-link a notification to the right tab/screen. */

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  sentAt: string | null;
  loanId?: string | null;
  reservationId?: string | null;
  isbn?: string | null;
  copyId?: string | null;
  digitalBookId?: string | null;
};

export function typeLabel(type: string): string {
  switch (type) {
    case "due_reminder":
      return "Due soon";
    case "due_reminder_urgent":
      return "Due tomorrow";
    case "overdue":
      return "Overdue";
    case "reservation_ready":
      return "Ready for pickup";
    case "reservation_cancelled":
      return "Reservation";
    case "fine_paid":
      return "Fine paid";
    default:
      return "Alert";
  }
}

export function typeTone(type: string): "warning" | "danger" | "success" | "muted" | "default" {
  switch (type) {
    case "overdue":
      return "danger";
    case "due_reminder_urgent":
    case "due_reminder":
      return "warning";
    case "reservation_ready":
      return "success";
    case "fine_paid":
      return "success";
    default:
      return "muted";
  }
}

export function formatNoticeTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

type Nav = {
  getParent?: () => { navigate: (name: string, params?: object) => void } | undefined;
  navigate: (name: string, params?: object) => void;
};

export function openNotificationTarget(navigation: Nav, item: InboxNotification) {
  const tabs = navigation.getParent?.();
  const type = item.type;
  const isbn = item.isbn || undefined;

  if (type === "reservation_ready" && isbn) {
    tabs?.navigate("Catalog", {
      screen: "BookDetail",
      params: { isbn },
    });
    return;
  }

  if (type === "reservation_ready" || type === "reservation_cancelled") {
    tabs?.navigate("Activity", { initialTab: "reservations" });
    return;
  }

  if (type === "due_reminder" || type === "due_reminder_urgent" || type === "overdue" || type === "fine_paid") {
    tabs?.navigate("Activity", { initialTab: "loans" });
    return;
  }

  if (item.digitalBookId) {
    tabs?.navigate("Catalog", {
      screen: "DigitalBookDetail",
      params: { digitalBookId: item.digitalBookId },
    });
    return;
  }

  if (isbn) {
    tabs?.navigate("Catalog", {
      screen: "BookDetail",
      params: { isbn },
    });
    return;
  }

  tabs?.navigate("Activity", { initialTab: "loans" });
}
