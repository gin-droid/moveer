import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Video, AlertTriangle, Dumbbell, Target, ExternalLink } from "lucide-react";
import { getYouTubeId, isDirectVideo, youtubeSearchUrl } from "@/lib/videoEmbed";

export default function ExerciseDetail() {
  const { id } = useParams();
  const [ex, setEx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setEx(await base44.entities.Exercise.get(id));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-zinc-500 text-sm">Caricamento…</div>;
  if (!ex) return <div className="text-zinc-500 text-sm">Esercizio non trovato.</div>;

  const ytId = getYouTubeId(ex.demo_video_url);
  const directVideo = isDirectVideo(ex.demo_video_url);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/esercizi" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Catalogo
      </Link>

      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-emerald-300/80">
          <span>{ex.macro_category}</span><span className="text-zinc-600">/</span><span>{ex.subcategory}</span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white tracking-tight">{ex.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800/70 text-zinc-300"><Dumbbell className="w-3 h-3" /> {ex.equipment || "Corpo libero"}</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800/70 text-zinc-300"><Target className="w-3 h-3" /> {ex.difficulty}</span>
        </div>
      </div>

      <p className="text-zinc-300 leading-relaxed">{ex.description}</p>

      {ex.setup_instructions && (
        <Section title="Setup & esecuzione">
          <p className="text-zinc-400 leading-relaxed text-sm whitespace-pre-line">{ex.setup_instructions}</p>
        </Section>
      )}

      {(ex.muscle_groups || []).length > 0 && (
        <Section title="Gruppi muscolari">
          <div className="flex flex-wrap gap-2">
            {ex.muscle_groups.map((m) => (
              <span key={m} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800/70 text-zinc-300">{m}</span>
            ))}
          </div>
        </Section>
      )}

      {(ex.common_mistakes || []).length > 0 && (
        <Section title="Errori comuni">
          <ul className="space-y-2">
            {ex.common_mistakes.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-400">
                <AlertTriangle className="w-4 h-4 text-amber-400/80 shrink-0 mt-0.5" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Demo video */}
      <Section title="Video dimostrativo">
        {ytId ? (
          <div className="aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              title={ex.name}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : directVideo ? (
          <div className="aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
            <video src={ex.demo_video_url} controls className="w-full h-full object-contain" />
          </div>
        ) : (
          <a
            href={youtubeSearchUrl(`${ex.name} ${ex.macro_category} esecuzione tecnica`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors border border-zinc-700"
          >
            <ExternalLink className="w-4 h-4" /> Cerca demo su YouTube
          </a>
        )}
      </Section>

      <Link
        to={`/analizza?exercise=${encodeURIComponent(ex.id)}`}
        className="inline-flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm px-5 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
      >
        <Video className="w-4 h-4" /> Analizza la mia esecuzione
      </Link>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="font-display font-semibold text-white mb-3">{title}</h2>
      {children}
    </div>
  );
}