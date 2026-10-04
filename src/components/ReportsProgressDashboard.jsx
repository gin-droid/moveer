import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import { TrendingUp, Activity, Zap, Gauge } from "lucide-react";

const severityWeight = { Lievo: 1, Moderato: 3, Grave: 6 };

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
};

const postureScore = (r) => {
  const issues = r.issues_detected || [];
  if (issues.length === 0) return r.score || 0;
  const penalty = issues.reduce((sum, i) => sum + (severityWeight[i.severity] || 1), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
};

const powerValue = (r) => {
  const motion = r.wearable_data?.motion;
  if (!motion) return null;
  return motion.peak_accel ?? motion.avg_accel ?? null;
};

/** @param {{active?: boolean, payload?: Array<{dataKey: string, name?: string, value: string | number}>, label?: string, unit?: string}} props */
const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-white font-medium">
          {p.name}: <span className="tabular-nums">{p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsProgressDashboard({ reports }) {
  const series = useMemo(() => {
    const sorted = [...reports]
      .filter((r) => r.created_date)
      .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
    return sorted.map((r) => ({
      date: formatDate(r.created_date),
      score: r.score ?? 0,
      posture: postureScore(r),
      power: powerValue(r),
      name: r.exercise_name,
    }));
  }, [reports]);

  const stats = useMemo(() => {
    if (series.length === 0) return null;
    const first = series[0];
    const last = series[series.length - 1];
    const scoreDelta = last.score - first.score;
    const postureDelta = last.posture - first.posture;
    const powerEntries = series.filter((s) => s.power != null);
    const powerDelta = powerEntries.length >= 2
      ? powerEntries[powerEntries.length - 1].power - powerEntries[0].power
      : null;
    const avgScore = Math.round(series.reduce((s, p) => s + p.score, 0) / series.length);
    return { scoreDelta, postureDelta, powerDelta, avgScore, count: series.length };
  }, [series]);

  if (series.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center">
        <TrendingUp className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">
          Servono almeno 2 analisi per visualizzare i trend nel tempo.
        </p>
      </div>
    );
  }

  const hasPower = series.some((s) => s.power != null);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Gauge}
          label="Punteggio medio"
          value={`${stats.avgScore}/100`}
          delta={stats.scoreDelta}
        />
        <KpiCard
          icon={Activity}
          label="Trend postura"
          value={`${series[series.length - 1].posture}/100`}
          delta={stats.postureDelta}
        />
        <KpiCard
          icon={Zap}
          label="Trend potenza"
          value={hasPower ? `${series[series.length - 1].power?.toFixed(1)} m/s²` : "N/D"}
          delta={stats.powerDelta}
          unit=" m/s²"
        />
        <KpiCard
          icon={TrendingUp}
          label="Analisi totali"
          value={stats.count}
        />
      </div>

      {/* Score trend */}
      <ChartCard title="Punteggio esecuzione nel tempo" icon={Gauge}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
            <Tooltip content={<CustomTooltip unit="/100" />} />
            <Area
              type="monotone"
              dataKey="score"
              name="Punteggio"
              stroke="#34d399"
              strokeWidth={2.5}
              fill="url(#scoreGrad)"
              dot={{ fill: "#34d399", r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Posture + Power trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Trend postura" icon={Activity}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
              <Tooltip content={<CustomTooltip unit="/100" />} />
              <Line
                type="monotone"
                dataKey="posture"
                name="Postura"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={{ fill: "#22d3ee", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Trend potenza (accelerazione)" icon={Zap}>
          {hasPower ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgb(39 39 42)" }} />
                <Tooltip content={<CustomTooltip unit=" m/s²" />} />
                <Line
                  type="monotone"
                  dataKey="power"
                  name="Potenza"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  dot={{ fill: "#fbbf24", r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-center px-6">
              <div>
                <Zap className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-xs">
                  Nessun dato wearable disponibile.
                  <br />Collega un dispositivo per visualizzare la potenza.
                </p>
              </div>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/** @param {{icon: import("react").ComponentType<any>, label: string, value: string | number, delta?: number | null, unit?: string}} props */
function KpiCard({ icon: Icon, label, value, delta, unit }) {
  const hasDelta = delta != null && delta !== 0;
  const positive = (delta || 0) > 0;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3.5">
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 text-emerald-300/80" />
        {hasDelta && (
          <span className={`text-[11px] font-medium tabular-nums ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? "+" : ""}{delta.toFixed(delta % 1 ? 1 : 0)}{unit}
          </span>
        )}
      </div>
      <div className="mt-2 text-lg font-display font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-emerald-300/80" />
        <h3 className="text-sm font-display font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}