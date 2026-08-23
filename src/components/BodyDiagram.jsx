import { useState } from "react";
import { Activity } from "lucide-react";
import { silhouettePath } from "@/lib/bodySilhouette";

const stressColor = (s) =>
  s >= 61 ? "#fb7185" : s >= 31 ? "#fbbf24" : "#34d399";

function Silhouette({ view, gender }) {
  return (
    <path
      d={silhouettePath(view, gender)}
      fill="none"
      stroke="rgba(161,161,170,0.6)"
      strokeWidth="0.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export default function BodyDiagram({ diagram, gender = "maschio" }) {
  const [view, setView] = useState("front");
  if (!diagram) return null;

  const front = diagram.front;
  const side = diagram.side;
  const hasFront = !!front;
  const hasSide = !!side;
  const activeData = view === "front" ? front : side;

  const allJoints = [
    ...((front || {}).joints || []),
    ...((side || {}).joints || []),
  ];
  const maxStress = allJoints.length
    ? Math.max(...allJoints.map((j) => j.stress || 0))
    : 0;

  return (
    <div className="space-y-4">
      {/* Toggle vista — un solo corpo alla volta */}
      <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/40 p-1">
        <button
          onClick={() => hasFront && setView("front")}
          disabled={!hasFront}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === "front"
              ? "bg-emerald-400 text-zinc-950"
              : "text-zinc-400 hover:text-white disabled:opacity-40"
          }`}
        >
          Vista frontale
        </button>
        <button
          onClick={() => hasSide && setView("side")}
          disabled={!hasSide}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === "side"
              ? "bg-emerald-400 text-zinc-950"
              : "text-zinc-400 hover:text-white disabled:opacity-40"
          }`}
        >
          Vista laterale
        </button>
      </div>

      <DiagramView
        view={activeData}
        title={view === "front" ? "Vista frontale" : "Vista laterale"}
        silhouette={view}
        gender={gender}
      />

      {/* Legenda stress */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="font-display font-semibold text-white text-sm">Stress articolare vs esecuzione ottima</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Legend color="#34d399" label="Basso (0-30%)" />
          <Legend color="#fbbf24" label="Moderato (31-60%)" />
          <Legend color="#fb7185" label="Alto (61-100%)" />
        </div>
        {maxStress > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Articolazione più stressata rispetto all'esecuzione ottima:{" "}
            <span className="font-medium" style={{ color: stressColor(maxStress) }}>{maxStress}%</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}

function DiagramView({ view, title, silhouette, gender }) {
  if (!view) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{title}</div>
        <div className="h-64 flex items-center justify-center text-sm text-zinc-600">Non disponibile</div>
      </div>
    );
  }
  const joints = view.joints || [];
  const segments = view.segments || [];
  const jointMap = Object.fromEntries(joints.map((j) => [j.id, j]));
  const refYs = [
    jointMap["shoulder_l"] || jointMap["shoulder"],
    jointMap["hip_l"] || jointMap["hip"],
    jointMap["knee_l"] || jointMap["knee"],
    jointMap["ankle_l"] || jointMap["ankle"],
  ].filter(Boolean).map((j) => j.y);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{title}</div>
      <svg viewBox="0 0 100 100" className="w-full h-auto mx-auto" style={{ maxWidth: 360, maxHeight: 440 }}>
        {/* sagoma corporea di sfondo */}
        <Silhouette view={silhouette} gender={gender} />

        {/* linee di riferimento orizzontali (spalle, bacino, ginocchia, caviglie) */}
        {refYs.map((y, i) => (
          <line key={`ref-${i}`} x1="2" y1={y} x2="98" y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" strokeDasharray="1.2 1.2" />
        ))}
        {/* asse verticale di riferimento */}
        <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(255,255,255,0.07)" strokeWidth="0.3" strokeDasharray="1 1.5" />

        {/* segmenti scheletrici */}
        {segments.map((s, i) => {
          const a = jointMap[s.from];
          const b = jointMap[s.to];
          if (!a || !b) return null;
          const col = s.misaligned ? "#fb7185" : "#71717a";
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={col}
              strokeWidth={s.misaligned ? 1.1 : 0.8}
              strokeLinecap="round"
              opacity={s.misaligned ? 0.95 : 0.7}
            />
          );
        })}

        {/* collegamenti esterni + scala stress */}
        {joints
          .filter((j) => (j.stress || 0) > 0)
          .map((j, i) => {
            const left = j.x < 50;
            const ex = left ? Math.max(4, j.x - 10) : Math.min(96, j.x + 10);
            const ey = j.y;
            const col = stressColor(j.stress);
            const barW = 7;
            const bx = left ? ex - barW : ex;
            return (
              <g key={`g-${i}`}>
                <line
                  x1={j.x}
                  y1={j.y}
                  x2={ex}
                  y2={ey}
                  stroke={col}
                  strokeWidth="0.25"
                  strokeDasharray="0.4 0.4"
                  opacity="0.5"
                />
                <rect x={bx} y={ey - 1.4} width={barW} height="2.8" rx="1" fill="rgba(255,255,255,0.08)" />
                <rect
                  x={bx}
                  y={ey - 1.4}
                  width={Math.max(0.3, (barW * j.stress) / 100)}
                  height="2.8"
                  rx="1"
                  fill={col}
                />
                <text
                  x={left ? bx - 0.5 : bx + barW + 0.5}
                  y={ey + 0.9}
                  fontSize="2.1"
                  fill={col}
                  textAnchor={left ? "end" : "start"}
                  style={{ fontWeight: 600 }}
                >
                  {j.stress}%
                </text>
              </g>
            );
          })}

        {/* giunzioni */}
        {joints.map((j, i) => {
          const col = stressColor(j.stress || 0);
          return (
            <g key={`j-${i}`}>
              <circle cx={j.x} cy={j.y} r="1.6" fill={col} stroke="#0a0a0a" strokeWidth="0.3" />
              <circle cx={j.x} cy={j.y} r="0.6" fill="#0a0a0a" opacity="0.4" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}