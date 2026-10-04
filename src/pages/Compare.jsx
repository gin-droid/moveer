import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appApi";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus, GitCompare, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import BottomSelectDrawer from "@/components/BottomSelectDrawer";

const sevColor = { Lievo: "text-amber-300 bg-amber-400/10", Moderato: "text-orange-300 bg-orange-400/10", Grave: "text-rose-300 bg-rose-400/10" };

export default function Compare() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState("");
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await appApi.entities.AnalysisReport.list("-created_date", 200);
        setReports(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Exercises with >=2 reports
  const exercises = useMemo(() => {
    const counts = {};
    reports.forEach((r) => {
      const key = r.exercise_name;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).filter((k) => counts[k] >= 2).sort();
  }, [reports]);

  // Auto-select first exercise
  useEffect(() => {
    if (!exerciseName && exercises.length) setExerciseName(exercises[0]);
  }, [exercises, exerciseName]);

  const exerciseReports = useMemo(() => {
    return reports
      .filter((r) => r.exercise_name === exerciseName)
      .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
  }, [reports, exerciseName]);

  // Default A = oldest, B = newest
  useEffect(() => {
    if (exerciseReports.length >= 2) {
      setIdA(exerciseReports[0].id);
      setIdB(exerciseReports[exerciseReports.length - 1].id);
    } else {
      setIdA(""); setIdB("");
    }
  }, [exerciseName, exerciseReports]);

  const chartData = useMemo(
    () => exerciseReports.map((r, i) => ({
      idx: i + 1,
      date: new Date(r.created_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      score: r.score,
      id: r.id,
    })),
    [exerciseReports]
  );

  const reportA = exerciseReports.find((r) => r.id === idA);
  const reportB = exerciseReports.find((r) => r.id === idB);

  const delta = reportA && reportB ? reportB.score - reportA.score : 0;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const deltaColor = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-zinc-400";

  if (loading) return <div className="text-zinc-500 text-sm">Caricamento…</div>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">Progressi nel tempo</h1>
        <p className="text-zinc-400 mt-2 text-sm">Confronta due analisi dello stesso esercizio per visualizzare i miglioramenti di tecnica e postura.</p>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Serve almeno un esercizio con due o più analisi per confrontare i progressi.</p>
          <Link to="/analizza" className="mt-4 inline-flex items-center gap-2 bg-emerald-400 text-zinc-950 font-semibold text-sm px-4 py-2.5 rounded-xl">
            <GitCompare className="w-4 h-4" /> Avvia una nuova analisi
          </Link>
        </div>
      ) : (
        <>
          {/* Exercise selector */}
          <BottomSelectDrawer
            value={exerciseName}
            onChange={setExerciseName}
            title="Seleziona esercizio"
            placeholder="Seleziona un esercizio"
            options={exercises.map((name) => ({
              value: name,
              label: `${name} (${reports.filter((r) => r.exercise_name === name).length} analisi)`,
            }))}
            className="sm:w-80"
          />

          {/* Trend chart */}
          {chartData.length >= 2 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="font-display font-semibold text-white text-sm">Trend del punteggio</h2>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
                    <XAxis dataKey="date" stroke="rgb(113 113 122)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="rgb(113 113 122)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "rgb(24 24 27)", border: "1px solid rgb(63 63 70)", borderRadius: 12, fontSize: 12, color: "#fff" }}
                      labelStyle={{ color: "#a1a1aa" }}
                      formatter={(v) => [`${v}/100`, "Punteggio"]}
                    />
                    <Line type="monotone" dataKey="score" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Report pickers */}
          {exerciseReports.length >= 2 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <ReportPicker label="Analisi A" reports={exerciseReports} value={idA} onChange={setIdA} />
              <ReportPicker label="Analisi B" reports={exerciseReports} value={idB} onChange={setIdB} />
            </div>
          )}

          {/* Comparison */}
          {reportA && reportB && (
            <div className="space-y-5">
              {/* Delta banner */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">Variazione punteggio</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-display font-semibold text-white">{reportA.score}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-xl sm:text-2xl font-display font-semibold text-white">{reportB.score}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 ${deltaColor}`}>
                  <DeltaIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-lg sm:text-xl font-display font-semibold">{delta > 0 ? "+" : ""}{delta} pt</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <ReportColumn report={reportA} tag="A" />
                <ReportColumn report={reportB} tag="B" highlight />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportPicker({ label, reports, value, onChange }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">{label}</div>
      <BottomSelectDrawer
        value={value}
        onChange={onChange}
        title={label}
        options={reports.map((r) => ({
          value: r.id,
          label: `${new Date(r.created_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })} — ${r.score}/100`,
        }))}
      />
    </div>
  );
}

/** @param {{report: any, tag: string, highlight?: boolean}} props */
function ReportColumn({ report, tag, highlight = false }) {
  const issues = report.issues_detected || [];
  const sevCounts = { Lievo: 0, Moderato: 0, Grave: 0 };
  issues.forEach((i) => { if (sevCounts[i.severity] !== undefined) sevCounts[i.severity]++; });

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${highlight ? "border-emerald-500/40 bg-emerald-400/5" : "border-zinc-800 bg-zinc-900/40"}`}>
      <div className="flex items-center justify-between">
        <span className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${highlight ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{tag}</span>
        <span className="text-2xl font-display font-semibold text-white">{report.score}<span className="text-sm text-zinc-500">/100</span></span>
      </div>
      <div className="text-xs text-zinc-500 mt-1">
        {new Date(report.created_date).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
      </div>

      <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{report.summary}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Problemi" value={issues.length} />
        <Mini label="Correzioni" value={(report.corrections || []).length} />
        <Mini label="Correttivi" value={(report.corrective_exercises || []).length} />
      </div>

      {issues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(sevCounts).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sevColor[k]}`}>{v} {k}</span>
          ))}
        </div>
      )}

      {issues.length > 0 && (
        <ul className="mt-4 space-y-2">
          {issues.map((iss, i) => (
            <li key={i} className="text-xs text-zinc-400 flex gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${iss.severity === "Grave" ? "bg-rose-400" : iss.severity === "Moderato" ? "bg-orange-400" : "bg-amber-400"}`} />
              <span><span className="text-zinc-300">{iss.title}.</span> {iss.description}</span>
            </li>
          ))}
        </ul>
      )}

      <Link to={`/report/${report.id}`} className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${highlight ? "text-emerald-300 hover:text-emerald-200" : "text-zinc-400 hover:text-white"} transition-colors`}>
        Report completo →
      </Link>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-zinc-800/40 py-2">
      <div className="text-lg font-display font-semibold text-white">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}