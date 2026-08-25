import { Link } from "react-router-dom";
import { ChevronRight, Video } from "lucide-react";

const diffColor = {
  Principiante: "text-emerald-300 bg-emerald-400/10",
  Intermedio: "text-amber-300 bg-amber-400/10",
  Avanzato: "text-rose-300 bg-rose-400/10",
};

export default function ExerciseStrip({ exercises }) {
  const items = exercises.slice(0, 10);
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold tracking-tight text-white">Esercizi in evidenza</h2>
        <Link to="/esercizi" className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1">
          Catalogo <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Horizontal scroll — mobile-first; wraps to grid on larger screens */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 scrollbar-hide">
        {items.map((e) => (
          <Link
            key={e.id}
            to={`/esercizi/${e.id}`}
            className="group snap-start shrink-0 w-44 sm:w-auto sm:shrink rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-secondary truncate">{e.macro_category}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${diffColor[e.difficulty] || ""}`}>
                {e.difficulty}
              </span>
            </div>
            <h3 className="mt-2 font-display font-semibold text-white text-sm leading-tight line-clamp-2">{e.name}</h3>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{e.subcategory}</div>
            <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs text-primary">
              <Video className="w-3.5 h-3.5" /> Analizza
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}