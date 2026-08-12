"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getNotifications } from "@/lib/api";

const POLL_INTERVAL_MS = 30000;

// The project has no global nav/layout, so this component is self-contained
// and embeds itself directly into each page's existing nav row (see
// dashboard/page.tsx) rather than assuming a shared header exists.
export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const unread = await getNotifications(true);
        if (!cancelled) setUnreadCount(unread.length);
      } catch {
        // Silently ignore — if the session expired, the host page's own
        // getMe() check will redirect to /login; the bell just shows no
        // badge in the meantime rather than disrupting the page.
      }
    }

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Bell className="w-[18px] h-[18px] text-slate-700" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}