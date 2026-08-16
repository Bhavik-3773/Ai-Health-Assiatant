"use client";

// NEW (Doctor Dashboard). Patient Detail — reuses existing, unmodified
// endpoints for everything except the patient profile itself:
//   - getPatientById()      -> GET /api/patients/{id}          (existing, now ownership-checked)
//   - getSensorHistory()    -> GET /api/sensors/{id}            (existing, now ownership-checked)
//   - getPredictions()      -> GET /api/predictions/{id}        (existing, now ownership-checked)
//   - getRecommendations()  -> GET /api/recommendations/{id}    (existing, now ownership-checked)
//   - getNotifications()    -> GET /api/notifications?patient_id=  (existing, extended)
// No new backend reads were needed for this screen — see PROJECT_CONTEXT.md
// §29 for why each of these was reused instead of duplicated.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  getMe,
  getPatientById,
  getSensorHistory,
  getPredictions,
  getRecommendations,
  getNotifications,
  type PatientProfile,
  type SensorReading,
  type Prediction,
  type Recommendation,
  type NotificationItem,
} from "@/lib/api";
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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DoctorPatientDetailPage() {
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;

  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        if (me.role !== "doctor" && me.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        const [profile, history, preds, recs, notifs] = await Promise.all([
          getPatientById(patientId),
          getSensorHistory(patientId, 50),
          getPredictions(patientId, 10),
          getRecommendations(patientId, 10),
          getNotifications(false, patientId),
        ]);
        setPatient(profile);
        setReadings(history.slice().reverse());
        setPredictions(preds);
        setRecommendations(recs);
        setNotifications(notifs);
      } catch (err: any) {
        // A 404 here means either the patient doesn't exist or (per
        // can_access_patient() in core/security.py) isn't assigned to this
        // doctor — both are shown the same way rather than redirecting to
        // /login, since the doctor's own session is still perfectly valid.
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, patientId]);

  if (loading) return <div className="p-10">Loading patient...</div>;

  if (notFound || !patient) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/doctor/patients" className="inline-flex items-center gap-1 text-sm text-slate-600 mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to patients
        </Link>
        <p className="text-slate-600">
          This patient wasn&apos;t found, or isn&apos;t assigned to you.
        </p>
      </main>
    );
  }

  const latest = readings[readings.length - 1];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <Link href="/doctor/patients" className="inline-flex items-center gap-1 text-sm text-slate-600 mb-2 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to patients
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">{patient.full_name ?? "Patient"}</h1>
        </div>
        <Navbar role="doctor" />
      </div>

      {/* Patient profile */}
      <div className="bg-white rounded-xl border p-4 sm:p-6 mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <ProfileField label="Age" value={patient.age ?? "--"} />
        <ProfileField label="Gender" value={patient.gender ?? "--"} />
        <ProfileField label="Blood Group" value={patient.blood_group ?? "--"} />
        <ProfileField label="Device ID" value={patient.device_id ?? "--"} />
        <ProfileField label="Height" value={patient.height_cm ? `${patient.height_cm} cm` : "--"} />
        <ProfileField label="Weight" value={patient.weight_kg ? `${patient.weight_kg} kg` : "--"} />
        <ProfileField label="Phone" value={patient.phone_number ?? "--"} />
        <ProfileField label="Emergency Contact" value={patient.emergency_contact_name ?? "--"} />
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <VitalCard label="Heart Rate" value={latest?.heart_rate ?? "--"} unit="bpm" />
        <VitalCard label="SpO2" value={latest?.spo2 ?? "--"} unit="%" />
        <VitalCard label="Temperature" value={latest?.temperature ?? "--"} unit="°C" />
        <VitalCard label="Steps" value={latest?.steps ?? "--"} unit="" />
        <VitalCard label="Sleep" value={latest?.sleep_hours ?? "--"} unit="hrs" />
        <VitalCard label="Water Intake" value={latest?.water_intake_ml ?? "--"} unit="ml" />
        <VitalCard label="Activity" value={latest?.activity_state ?? "--"} unit="" />
        <VitalCard
          label="Latest Prediction"
          value={predictions[0] ? LABEL_DISPLAY[predictions[0].label] ?? predictions[0].label : "n/a"}
          unit={predictions[0] ? `${Math.round(predictions[0].probability * 100)}%` : ""}
        />
      </div>

      {/* Historical charts — same Recharts pattern used in history/page.tsx */}
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-3 mb-8 sm:mb-10">
        <ChartCard title="Heart Rate" dataKey="heart_rate" data={readings} domain={[40, 160]} stroke="#dc2626" />
        <ChartCard title="SpO2" dataKey="spo2" data={readings} domain={[85, 100]} stroke="#2563eb" />
        <ChartCard title="Temperature" dataKey="temperature" data={readings} domain={[35, 40]} stroke="#d97706" />
      </div>

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
        <section className="bg-white rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Prediction History</h2>
          <ul className="space-y-3">
            {predictions.map((p) => (
              <li key={p.id} className="border-l-4 border-slate-900 pl-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{LABEL_DISPLAY[p.label] ?? p.label}</p>
                  <span className="text-xs text-slate-500">{Math.round(p.probability * 100)}%</span>
                </div>
                <p className="text-xs text-slate-500">{formatTimestamp(p.created_at)}</p>
              </li>
            ))}
            {predictions.length === 0 && <p className="text-slate-500 text-sm">No predictions yet.</p>}
          </ul>
        </section>

        <section className="bg-white rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
          <ul className="space-y-3">
            {recommendations.map((r) => (
              <li key={r.id} className="border-l-4 border-slate-900 pl-4">
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-slate-600">{r.body}</p>
              </li>
            ))}
            {recommendations.length === 0 && <p className="text-slate-500 text-sm">No recommendations yet.</p>}
          </ul>
        </section>

        <section className="bg-white rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Notifications & Alerts</h2>
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li key={n.id} className={`border-l-4 pl-4 ${n.type === "emergency" ? "border-red-500" : "border-slate-300"}`}>
                <div className="flex items-center gap-1.5">
                  {n.type === "emergency" && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                  <p className="font-medium">{n.title}</p>
                </div>
                <p className="text-sm text-slate-600">{n.message}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(n.created_at)}</p>
              </li>
            ))}
            {notifications.length === 0 && <p className="text-slate-500 text-sm">No notifications.</p>}
          </ul>
        </section>
      </div>
    </main>
  );
}

function ProfileField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function VitalCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5 min-w-0">
      <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-semibold mt-1 break-words capitalize">
        {value} <span className="text-xs sm:text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

function ChartCard({
  title,
  dataKey,
  data,
  domain,
  stroke,
}: {
  title: string;
  dataKey: keyof SensorReading;
  data: SensorReading[];
  domain: [number, number];
  stroke: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="recorded_at" hide />
            <YAxis domain={domain} width={32} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
