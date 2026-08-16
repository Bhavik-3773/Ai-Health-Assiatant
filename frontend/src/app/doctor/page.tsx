"use client";

// NEW (Doctor Dashboard). Overview screen — reuses getMe() + the same
// auth-guard pattern as every existing patient page, and the same
// Navbar/NotificationBell components. Data comes from the new
// GET /api/patients/overview endpoint (routers/patients.py) — no existing
// endpoint could safely aggregate this across a doctor's whole patient
// panel without one HTTP call per patient.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Users, Activity, ClipboardList } from "lucide-react";
import { getMe, getPatientsOverview, type DoctorOverview } from "@/lib/api";
import Navbar from "@/components/Navbar";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LABEL_DISPLAY: Record<string, string> = {
  healthy: "Healthy",
  fatigue: "Fatigue",
  stress: "Stress",
  fever_risk: "Fever Risk",
  heart_risk: "Heart Risk",
  sleep_deprivation: "Sleep Deprivation",
  dehydration: "Dehydration",
};

export default function DoctorOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<DoctorOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        // Role protection: patients must not reach doctor pages.
        if (me.role !== "doctor" && me.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        const data = await getPatientsOverview();
        setOverview(data);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="p-10">Loading overview...</div>;
  if (!overview) return null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Doctor Overview</h1>
        <Navbar role="doctor" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <StatCard icon={Users} label="Total Patients" value={overview.total_patients} />
        <StatCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={overview.attention_count}
          accent={overview.attention_count > 0}
        />
      </div>

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
        <section className="bg-white rounded-xl border p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold">Recent Alerts</h2>
          </div>
          <ul className="space-y-3">
            {overview.recent_alerts.map((a) => (
              <li key={a.id} className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/doctor/patients/${a.patient.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.patient.full_name}
                  </Link>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatTimestamp(a.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{a.title}</p>
              </li>
            ))}
            {overview.recent_alerts.length === 0 && (
              <p className="text-slate-500 text-sm">No recent alerts.</p>
            )}
          </ul>
        </section>

        <section className="bg-white rounded-xl border p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold">Recent Predictions</h2>
          </div>
          <ul className="space-y-3">
            {overview.recent_predictions.map((p) => (
              <li key={p.id} className="border-l-4 border-slate-900 pl-4">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/doctor/patients/${p.patient.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.patient.full_name}
                  </Link>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatTimestamp(p.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  {LABEL_DISPLAY[p.label] ?? p.label} · {Math.round(p.probability * 100)}%
                </p>
              </li>
            ))}
            {overview.recent_predictions.length === 0 && (
              <p className="text-slate-500 text-sm">No recent predictions.</p>
            )}
          </ul>
        </section>

        <section className="bg-white rounded-xl border p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Heart Rate</th>
                  <th className="py-2 pr-4">SpO2</th>
                  <th className="py-2 pr-4">Temp</th>
                  <th className="py-2 pr-4">Activity</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent_activity.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/doctor/patients/${s.patient.id}`} className="hover:underline">
                        {s.patient.full_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{s.heart_rate ?? "--"} bpm</td>
                    <td className="py-2 pr-4">{s.spo2 ?? "--"}%</td>
                    <td className="py-2 pr-4">{s.temperature ?? "--"}°C</td>
                    <td className="py-2 pr-4 capitalize">{s.activity_state ?? "--"}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">
                      {formatTimestamp(s.recorded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overview.recent_activity.length === 0 && (
              <p className="text-slate-500 text-sm py-2">No recent activity.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className={`w-4 h-4 ${accent ? "text-red-600" : ""}`} />
        <p className="text-xs sm:text-sm truncate">{label}</p>
      </div>
      <p className={`text-2xl sm:text-3xl font-semibold mt-1 ${accent ? "text-red-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}
