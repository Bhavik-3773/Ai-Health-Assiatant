"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getMe, getMyPatientProfile, getSensorHistory, getPredictions, getRecommendations } from "@/lib/api";
import Navbar from "@/components/Navbar";

type Reading = {
  recorded_at: string;
  heart_rate: number | null;
  spo2: number | null;
  temperature: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await getMe();
        const patient = await getMyPatientProfile();
        const [history, preds, recs] = await Promise.all([
          getSensorHistory(patient.id, 50),
          getPredictions(patient.id, 5),
          getRecommendations(patient.id, 5),
        ]);
        setReadings(history.reverse());
        setPredictions(preds);
        setRecommendations(recs);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="p-10">Loading dashboard...</div>;

  const latest = readings[readings.length - 1];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Your Health Dashboard</h1>
        <Navbar />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <MetricCard label="Heart Rate" value={latest?.heart_rate ?? "--"} unit="bpm" />
        <MetricCard label="SpO2" value={latest?.spo2 ?? "--"} unit="%" />
        <MetricCard label="Temperature" value={latest?.temperature ?? "--"} unit="°C" />
        <MetricCard
          label="Latest Prediction"
          value={predictions[0]?.label ?? "n/a"}
          unit={predictions[0] ? `${Math.round(predictions[0].probability * 100)}%` : ""}
        />
      </div>

      <div className="bg-white rounded-xl border p-4 sm:p-6 mb-8 sm:mb-10">
        <h2 className="text-lg font-semibold mb-4">Heart Rate Trend</h2>
        <div className="h-[220px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="recorded_at" hide />
              <YAxis domain={[40, 160]} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="heart_rate" stroke="#0f172a" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Recommendations</h2>
        <ul className="space-y-3">
          {recommendations.map((r) => (
            <li key={r.id} className="border-l-4 border-slate-900 pl-4">
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-slate-600">{r.body}</p>
            </li>
          ))}
          {recommendations.length === 0 && <p className="text-slate-500 text-sm">No recommendations yet.</p>}
        </ul>
      </div>
    </main>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5 min-w-0">
      <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-semibold mt-1 break-words">
        {value} <span className="text-xs sm:text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}