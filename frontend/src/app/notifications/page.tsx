"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Trash2,
  CheckCircle2,
  BellOff,
  type LucideIcon,
} from "lucide-react";
import {
  getMe,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  type NotificationItem,
  type NotificationType,
} from "@/lib/api";

type Priority = "critical" | "warning" | "normal";
type FilterKey = "all" | Priority;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "normal", label: "Normal" },
];

// Maps the existing notifications.type column (CHECK: emergency/info/reminder —
// see database/schema.sql) to the Critical/Warning/Normal priority levels.
// This is presentation-layer only, the same pattern already used by
// RISK_BY_LABEL in prediction/page.tsx and TITLE_TO_CATEGORY in
// recommendations/page.tsx. No backend/table change. Unrecognized values
// default to "normal", mirroring the column's own DB default of 'info'.
const PRIORITY_BY_TYPE: Record<NotificationType, Priority> = {
  emergency: "critical",
  reminder: "warning",
  info: "normal",
};

function getPriority(type: NotificationType): Priority {
  return PRIORITY_BY_TYPE[type] ?? "normal";
}

const PRIORITY_STYLES: Record<
  Priority,
  {
    badgeBg: string;
    badgeText: string;
    label: string;
    icon: LucideIcon;
    iconColor: string;
  }
> = {
  critical: {
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    label: "Critical",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  warning: {
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    label: "Warning",
    icon: AlertCircle,
    iconColor: "text-amber-500",
  },
  normal: {
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-600",
    label: "Normal",
    icon: Info,
    iconColor: "text-slate-400",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        await getMe();
        const data = await getNotifications(false);
        setNotifications(data);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { all: notifications.length, critical: 0, warning: 0, normal: 0 };
    for (const n of notifications) {
      result[getPriority(n.type)] += 1;
    }
    return result;
  }, [notifications]);

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => getPriority(n.type) === filter);
  }, [notifications, filter]);

  const handleMarkRead = useCallback(async (id: number) => {
    setMarkingIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      setError("Failed to mark notification as read. Please try again.");
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this notification? This cannot be undone.")) {
      return;
    }
    setDeletingIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Failed to delete notification. Please try again.");
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  if (loading) return <div className="p-10">Loading notifications...</div>;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <span className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            {unreadCount} unread
          </span>
        )}
      </div>
      <p className="text-slate-500 mb-6">Alerts and updates about your health readings.</p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              filter === tab.key
                ? "bg-slate-900 text-white border-slate-900"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label} <span className="opacity-70">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500 flex flex-col items-center gap-2">
          <BellOff className="w-6 h-6 text-slate-300" />
          {notifications.length === 0 ? "No notifications yet." : "No notifications match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              marking={markingIds.has(n.id)}
              deleting={deletingIds.has(n.id)}
              onMarkRead={() => handleMarkRead(n.id)}
              onDelete={() => handleDelete(n.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function NotificationCard({
  notification,
  marking,
  deleting,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationItem;
  marking: boolean;
  deleting: boolean;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const priority = getPriority(notification.type);
  const styles = PRIORITY_STYLES[priority];
  const Icon = styles.icon;

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 ${
        notification.is_read ? "bg-white border-slate-200" : "bg-slate-50 border-slate-300"
      } ${deleting ? "opacity-50 pointer-events-none" : ""}`}
    >
      <span className={`flex items-center justify-center w-9 h-9 rounded-lg bg-white border shrink-0 ${styles.iconColor}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {!notification.is_read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
            <p className="font-medium">{notification.title}</p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${styles.badgeBg} ${styles.badgeText}`}>
            {styles.label}
          </span>
        </div>

        <p className="text-sm text-slate-600 mt-1">{notification.message}</p>

        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {formatDateTime(notification.created_at)}
          </div>

          <div className="flex items-center gap-2">
            {!notification.is_read && (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={marking}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {marking ? "Marking..." : "Mark read"}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}