"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, Search, X } from "lucide-react";
import {
  getMe,
  getMyPatientProfile,
  getSensorHistoryPage,
  type SensorReading,
  type TimeRange,
} from "@/lib/api";

const PAGE_SIZE = 10;
const CHART_POINT_LIMIT = 200;

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChartTick(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" });
}

export default function HistoryPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<TimeRange>("24h");
  const [searchDate, setSearchDate] = useState<string>("");

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SensorReading[]>([]);
  const [total, setTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  const [chartData, setChartData] = useState<SensorReading[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Initial auth + patient load, mirroring the pattern used in dashboard/page.tsx
  useEffect(() => {
    async function init() {
      try {
        await getMe();
        const patient = await getMyPatientProfile();
        setPatientId(patient.id);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const activeFilter = searchDate ? { date: searchDate } : { range };

  const loadTable = useCallback(async () => {
    if (!patientId) return;
    setTableLoading(true);
    setError(null);
    try {
      const result = await getSensorHistoryPage(patientId, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        ...activeFilter,
      });
      setRows(result.data);
      setTotal(result.total);
    } catch {
      setError("Failed to load sensor history. Please try again.");
    } finally {
      setTableLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, page, range, searchDate]);

  const loadChart = useCallback(async () => {
    if (!patientId) return;
    setChartLoading(true);
    try {
      const result = await getSensorHistoryPage(patientId, {
        limit: CHART_POINT_LIMIT,
        offset: 0,
        ...activeFilter,
      });
      setChartData([...result.data].reverse()); // API returns newest-first; charts need chronological order
    } catch {
      // Table error banner already covers this; chart just stays empty.
    } finally {
      setChartLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, range, searchDate]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  function handleRangeSelect(value: TimeRange) {
    setSearchDate("");
    setRange(value);
    setPage(1);
  }

  function handleSearchDateChange(value: string) {
    setSearchDate(value);
    setPage(1);
  }

  function clearSearchDate() {
    setSearchDate("");
    setPage(1);
  }

  if (loading) return <div className="p-10">Loading history...</div>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">Sensor History</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleRangeSelect(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                !searchDate && range === opt.value
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={searchDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => handleSearchDateChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            aria-label="Search by date"
          />
          {searchDate && (
            <button
              type="button"
              onClick={clearSearchDate}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Clear date search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <ChartCard title="Heart Rate (bpm)" data={chartData} dataKey="heart_rate" color="#dc2626" loading={chartLoading} />
        <ChartCard title="SpO2 (%)" data={chartData} dataKey="spo2" color="#2563eb" loading={chartLoading} />
        <ChartCard title="Temperature (°C)" data={chartData} dataKey="temperature" color="#d97706" loading={chartLoading} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Heart Rate</th>
                <th className="px-4 py-3 font-medium">SpO2</th>
                <th className="px-4 py-3 font-medium">Temperature</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tableLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!tableLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No readings found for this filter.
                  </td>
                </tr>
              )}
              {!tableLoading &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-700">{formatTimestamp(r.recorded_at)}</td>
                    <td className="px-4 py-3">{r.heart_rate ?? "--"} bpm</td>
                    <td className="px-4 py-3">{r.spo2 ?? "--"} %</td>
                    <td className="px-4 py-3">{r.temperature ?? "--"} °C</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 text-sm">
          <span className="text-slate-500">
            {total === 0 ? "0 results" : `${total} result${total === 1 ? "" : "s"}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || tableLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-white"
            >
              Prev
            </button>
            <span className="text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || tableLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  color,
  loading,
}: {
  title: string;
  data: SensorReading[];
  dataKey: "heart_rate" | "spo2" | "temperature";
  color: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="recorded_at" tickFormatter={formatChartTick} tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(v) => formatTimestamp(v as string)} />
            <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}