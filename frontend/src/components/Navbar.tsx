"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const PATIENT_LINKS = [
  { href: "/history", label: "History" },
  { href: "/prediction", label: "Prediction" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/profile", label: "My Profile" },
  { href: "/settings", label: "Settings" },
];

// NEW (Doctor Dashboard). Doctors don't have a Patient row, so the
// patient-only links above (Profile/Settings/History/etc., all backed by
// /api/patients/me) don't apply to them — this is a separate, smaller link
// set rather than reusing PATIENT_LINKS.
const DOCTOR_LINKS = [
  { href: "/doctor", label: "Overview" },
  { href: "/doctor/patients", label: "Patients" },
];

// Responsive nav row used on the dashboard header. On md+ screens this
// renders the same horizontal row of links + bell that dashboard/page.tsx
// used to render inline. Below md, the links collapse into a toggleable
// dropdown panel behind a hamburger button so the row never overflows or
// wraps awkwardly on narrow (tablet/mobile) screens.
//
// `role` is NEW and optional (Doctor Dashboard): omitting it (every
// existing call site) preserves the exact original patient link set and
// behavior; pass role="doctor" from the new doctor pages to get the
// doctor-appropriate links instead.
export default function Navbar({ role }: { role?: "patient" | "doctor" | "admin" }) {
  const [open, setOpen] = useState(false);
  const links = role === "doctor" ? DOCTOR_LINKS : PATIENT_LINKS;

  return (
    <div className="relative flex items-center gap-3">
      {/* Full link row: visible md and up */}
      <div className="hidden md:flex items-center gap-3">
        {links.map((link) => (
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
          {links.map((link) => (
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
