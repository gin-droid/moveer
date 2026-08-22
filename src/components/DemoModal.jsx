import React from "react";
import { X } from "lucide-react";
import { getYouTubeId, isDirectVideo } from "@/lib/videoEmbed";

export default function DemoModal({ exercise, onClose }) {
  if (!exercise) return null;
  const ytId = getYouTubeId(exercise.demo_video_url);
  const direct = isDirectVideo(exercise.demo_video_url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">
              {exercise.macro_category} / {exercise.subcategory}
            </div>
            <h3 className="font-display font-semibold text-white truncate">{exercise.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              title={exercise.name}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : direct ? (
            <video src={exercise.demo_video_url} controls className="w-full h-full object-contain" />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              Video non disponibile
            </div>
          )}
        </div>
      </div>
    </div>
  );
}