"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, ActivitySquare } from "lucide-react";
import { getMe, getMyPatientProfile, getPredictions, type Prediction } from "@/lib/api";

const PAGE_SIZE = 10;

type RiskLevel = "low" | "medium" | "high";

// Derived from label, not stored anywhere in the DB. fever_risk/heart_risk
// map to High because those are the two categories that also correlate
// with sensors.py's existing emergency-threshold checks (temperature/SpO2).
// Any future/unrecognized label defaults to Medium, never Low, so an
// unmapped condition is never silently under-represented as safe.
const RISK_BY_LABEL: Record<string, RiskLevel> = {
  healthy: "low",
  fatigue: "medium",
  stress: "medium",
  sleep_deprivation: "medium",
  dehydration: "medium",
  fever_risk: "high",
  heart_risk: "high",
};

function getRiskLevel(label: string): RiskLevel {
  return RISK_BY_LABEL[label] ?? "medium";
}

// General symptoms commonly associated with each prediction category.
// Not measured or patient-reported data — this system only collects
// vitals (heart rate, SpO2, temperature, etc.), not symptoms. Displayed
// as informational context alongside the model's actual output.
const SYMPTOMS_BY_LABEL: Record<string, string[]> = {
  healthy: ["No abnormal symptoms detected"],
  fatigue: ["Low energy", "Elevated resting heart rate", "Reduced sleep duration"],
  stress: ["Elevated heart rate", "Restlessness"],
  fever_risk: ["Elevated body temperature", "Possible chills"],
  heart_risk: ["Low blood oxygen (SpO2)", "Irregular heart rate"],
  sleep_deprivation: ["Insufficient sleep duration", "Daytime fatigue"],
  dehydration: ["Low fluid intake", "Possible dizziness or headache"],
};

function getSymptoms(label: string): string[] {
  return SYMPTOMS_BY_LABEL[label] ?? ["No specific symptoms listed for this category"];
}

const RISK_STYLES: Record<
  RiskLevel,
  { cardBg: string; cardBorder: string; badgeBg: string; badgeText: string; label: string; dot: string }
> = {
  low: {
    cardBg: "bg-emerald-50",
    cardBorder: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    label: "Low Risk",
    dot: "bg-emerald-500",
  },
  medium: {
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-200",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    label: "Medium Risk",
    dot: "bg-amber-500",
  },
  high: {
    cardBg: "bg-red-50",
    cardBorder: "border-red-200",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    label: "High Risk",
    dot: "bg-red-500",
  },
};

function formatLabel(label: string): string {
  return label
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PredictionPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await getMe();
        const patient = await getMyPatientProfile();
        setPatientId(patient.id);
        const first = await getPredictions(patient.id, PAGE_SIZE, 0);
        setPredictions(first);
        setOffset(first.length);
        setHasMore(first.length === PAGE_SIZE);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const loadMore = useCallback(async () => {
    if (!patientId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await getPredictions(patientId, PAGE_SIZE, offset);
      setPredictions((prev) => [...prev, ...next]);
      setOffset((prev) => prev + next.length);
      setHasMore(next.length === PAGE_SIZE);
    } catch {
      setError("Failed to load more predictions. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [patientId, offset, hasMore, loadingMore]);

  if (loading) return <div className="p-10">Loading predictions...</div>;

  const latest = predictions[0];
  const history = predictions.slice(1);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">AI Health Prediction</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!latest ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          No predictions yet. Predictions are generated automatically once sensor readings start coming in.
        </div>
      ) : (
        <>
          <PredictionCard prediction={latest} featured />

          <h2 className="text-lg font-semibold mt-10 mb-4 flex items-center gap-2">
            <ActivitySquare className="w-5 h-5" /> Prediction History
          </h2>

          {history.length === 0 ? (
            <p className="text-slate-500 text-sm">No earlier predictions yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((p) => (
                <PredictionCard key={p.id} prediction={p} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function PredictionCard({ prediction, featured = false }: { prediction: Prediction; featured?: boolean }) {
  const risk = getRiskLevel(prediction.label);
  const styles = RISK_STYLES[risk];
  const symptoms = getSymptoms(prediction.label);
  const confidencePct = Math.round(prediction.probability * 100);

  return (
    <div className={`rounded-xl border ${styles.cardBorder} ${styles.cardBg} ${featured ? "p-6" : "p-4"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
          <h3 className={featured ? "text-xl font-bold" : "text-base font-semibold"}>{formatLabel(prediction.label)}</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles.badgeBg} ${styles.badgeText}`}>
          {styles.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs text-slate-500">Confidence Score</p>
          <p className={featured ? "text-2xl font-bold" : "text-lg font-semibold"}>{confidencePct}%</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          {formatDateTime(prediction.created_at)}
        </div>
      </div>

      {prediction.explanation && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Reasons</p>
          <p className="text-sm text-slate-700">{prediction.explanation}</p>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 mb-1">
          Symptoms <span className="font-normal">(typical for this category, not directly measured)</span>
        </p>
        <ul className="text-sm text-slate-700 space-y-1">
          {symptoms.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              {risk === "low" ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
              )}
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}