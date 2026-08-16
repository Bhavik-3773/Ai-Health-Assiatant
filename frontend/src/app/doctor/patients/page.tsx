"use client";

// NEW (Doctor Dashboard). Patient List — reuses the existing GET
// /api/patients endpoint (routers/patients.py), now scoped server-side to
// the calling doctor's assigned patients (Patient.doctor_id), with
// include_status=true attaching each row's latest vitals/prediction/alert
// count in the same response so this page doesn't need one request per
// patient.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, AlertTriangle } from "lucide-react";
import { getMe, getDoctorPatients, type PatientProfile } from "@/lib/api";
import Navbar from "@/components/Navbar";

const LABEL_DISPLAY: Record<string, string> = {
  healthy: "Healthy",
  fatigue: "Fatigue",
  stress: "Stress",
  fever_risk: "Fever Risk",
  heart_risk: "Heart Risk",
  sleep_deprivation: "Sleep Deprivation",
  dehydration: "Dehydration",
};

const HIGH_RISK_LABELS = new Set(["heart_risk", "fever_risk"]);

function healthStatus(p: PatientProfile): { text: string; className: string } {
  if ((p.unread_alert_count ?? 0) > 0) {
    return { text: "Alert", className: "bg-red-100 text-red-700" };
  }
  if (p.latest_prediction_label && HIGH_RISK_LABELS.has(p.latest_prediction_label)) {
    return { text: "At Risk", className: "bg-amber-100 text-amber-700" };
  }
  if (p.latest_prediction_label) {
    return { text: "Stable", className: "bg-green-100 text-green-700" };
  }
  return { text: "No Data", className: "bg-slate-100 text-slate-600" };
}

export default function DoctorPatientListPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  async function loadPatients(searchTerm?: string) {
    const data = await getDoctorPatients({ search: searchTerm || undefined, includeStatus: true });
    setPatients(data);
  }

  useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        if (me.role !== "doctor" && me.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        await loadPatients();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      await loadPatients(search);
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <div className="p-10">Loading patients...</div>;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">My Patients</h1>
        <Navbar role="doctor" />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by device ID..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Latest Vitals</th>
              <th className="py-3 px-4">Latest Prediction</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const status = healthStatus(p);
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-medium">{p.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-slate-500">{p.device_id ?? "No device"}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                      {status.text === "Alert" && <AlertTriangle className="w-3 h-3" />}
                      {status.text}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {p.latest_heart_rate ?? "--"} bpm · {p.latest_spo2 ?? "--"}% · {p.latest_temperature ?? "--"}°C
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {p.latest_prediction_label
                      ? `${LABEL_DISPLAY[p.latest_prediction_label] ?? p.latest_prediction_label} (${Math.round(
                          (p.latest_prediction_probability ?? 0) * 100
                        )}%)`
                      : "--"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/doctor/patients/${p.id}`}
                      className="text-slate-900 font-medium hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {patients.length === 0 && (
          <p className="text-slate-500 text-sm p-6">No patients assigned to you yet.</p>
        )}
      </div>
    </main>
  );
}
