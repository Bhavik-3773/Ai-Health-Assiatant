"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const NAV_LINKS = [
  { href: "/history", label: "History" },
  { href: "/prediction", label: "Prediction" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/profile", label: "My Profile" },
  { href: "/settings", label: "Settings" },
];

// Responsive nav row used on the dashboard header. On md+ screens this
// renders the same horizontal row of links + bell that dashboard/page.tsx
// used to render inline. Below md, the links collapse into a toggleable
// dropdown panel behind a hamburger button so the row never overflows or
// wraps awkwardly on narrow (tablet/mobile) screens. No new links, colors,
// or behavior were added — this only changes how the existing nav row
// lays out at small widths.
export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-3">
      {/* Full link row: visible md and up */}
      <div className="hidden md:flex items-center gap-3">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <NotificationBell />

      {/* Hamburger toggle: visible below md only */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-50"
      >
        {open ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
      </button>

      {/* Collapsible mobile menu panel */}
      {open && (
        <div className="md:hidden absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
