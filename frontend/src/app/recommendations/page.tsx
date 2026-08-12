"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HeartPulse,
  Utensils,
  Dumbbell,
  Moon,
  Droplet,
  Pill,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { getMe, getMyPatientProfile, getRecommendations, type Recommendation } from "@/lib/api";

// ---------- Category model ----------
//
// The backend (app/ml/recommender.py) generates recommendations as plain
// (title, body) pairs keyed off the ML prediction label — it has no
// concept of "category". Grouping into Lifestyle / Food / Exercise / Sleep /
// Hydration is a presentation concern only, so it is derived here from the
// fixed set of titles recommender.py already produces, the same way
// prediction/page.tsx derives a risk level from prediction.label without
// changing any backend logic.

type CategoryKey = "lifestyle" | "food" | "exercise" | "sleep" | "hydration" | "medicine";

const CATEGORY_ORDER: CategoryKey[] = ["lifestyle", "food", "exercise", "sleep", "hydration", "medicine"];

const CATEGORY_META: Record<CategoryKey, { label: string; description: string; icon: LucideIcon }> = {
  lifestyle: {
    label: "Lifestyle Advice",
    description: "General wellbeing guidance based on your recent vitals",
    icon: HeartPulse,
  },
  food: {
    label: "Food Recommendations",
    description: "Nutrition guidance based on your recent vitals",
    icon: Utensils,
  },
  exercise: {
    label: "Exercise Suggestions",
    description: "Activity and movement guidance",
    icon: Dumbbell,
  },
  sleep: {
    label: "Sleep Recommendations",
    description: "Guidance for improving rest and recovery",
    icon: Moon,
  },
  hydration: {
    label: "Hydration Advice",
    description: "Guidance on water intake",
    icon: Droplet,
  },
  medicine: {
    label: "Medicine Reminder",
    description: "Medication scheduling and reminders",
    icon: Pill,
  },
};

// Maps the exact titles produced by app/ml/recommender.py to a display
// category. Any title not listed here (e.g. a future label added to
// recommender.py) falls back to Lifestyle Advice rather than being dropped,
// mirroring the RISK_BY_LABEL fallback pattern in prediction/page.tsx.
const TITLE_TO_CATEGORY: Record<string, CategoryKey> = {
  "Monitor Temperature": "lifestyle",
  "Consult a Doctor": "lifestyle",
  "Low Oxygen Saturation": "lifestyle",
  "Elevated Heart Rate": "lifestyle",
  "Rest and Recover": "lifestyle",
  "Keep It Up": "lifestyle",
  "Nutrition Check": "food",
  "Breathing Exercise": "exercise",
  "Improve Sleep Hygiene": "sleep",
  "Avoid Stimulants": "sleep",
  "Increase Water Intake": "hydration",
  "Track Intake": "hydration",
};

function getCategory(title: string): CategoryKey {
  return TITLE_TO_CATEGORY[title] ?? "lifestyle";
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

function groupByCategory(items: Recommendation[]): Record<CategoryKey, Recommendation[]> {
  const groups: Record<CategoryKey, Recommendation[]> = {
    lifestyle: [],
    food: [],
    exercise: [],
    sleep: [],
    hydration: [],
    medicine: [],
  };
  for (const item of items) {
    groups[getCategory(item.title)].push(item);
  }
  return groups;
}

export default function RecommendationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    async function load() {
      try {
        await getMe();
        const patient = await getMyPatientProfile();
        const data = await getRecommendations(patient.id, 100);
        setRecommendations(data);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="p-10">Loading recommendations...</div>;

  const grouped = groupByCategory(recommendations);
  const hasAnyReal = recommendations.length > 0;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">AI Recommendations</h1>
      <p className="text-slate-500 mb-8">
        Personalized guidance generated from your most recent health predictions.
      </p>

      {!hasAnyReal && (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500 mb-10">
          No recommendations yet. Recommendations are generated automatically once sensor readings and
          predictions start coming in.
        </div>
      )}

      <div className="space-y-10">
        {CATEGORY_ORDER.filter((key) => key !== "medicine").map((key) => (
          <CategorySection key={key} categoryKey={key} items={grouped[key]} />
        ))}

        {/* Medicine Reminder is a placeholder only — the platform has no
            medication data source yet (no model, no API, no schedule), so
            this section is always rendered statically regardless of any
            fetched data. */}
        <MedicinePlaceholderSection />
      </div>
    </main>
  );
}

function CategorySection({ categoryKey, items }: { categoryKey: CategoryKey; items: Recommendation[] }) {
  const meta = CATEGORY_META[categoryKey];
  const Icon = meta.icon;

  return (
    <section>
      <div className="flex items-center gap-3 mb-1">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 text-white shrink-0">
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-xs text-slate-500">{meta.description}</p>
        </div>
        {items.length > 0 && (
          <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 mt-4 ml-12">No {meta.label.toLowerCase()} yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {items.map((item) => (
            <RecommendationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationCard({ item }: { item: Recommendation }) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col">
      <p className="font-medium">{item.title}</p>
      <p className="text-sm text-slate-600 mt-1 flex-1">{item.body}</p>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
        <Clock className="w-3.5 h-3.5" />
        {formatDateTime(item.created_at)}
      </div>
    </div>
  );
}

function MedicinePlaceholderSection() {
  const meta = CATEGORY_META.medicine;
  const Icon = meta.icon;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 text-white shrink-0">
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-xs text-slate-500">{meta.description}</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6 flex items-start gap-4">
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border shrink-0">
          <Pill className="w-5 h-5 text-slate-400" />
        </span>
        <div>
          <p className="font-medium text-slate-700">
            Coming Soon <span className="ml-2 text-xs font-semibold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">Placeholder</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Medicine reminders are not available yet — this platform does not currently collect medication or
            prescription data.
          </p>
        </div>
      </div>
    </section>
  );
}