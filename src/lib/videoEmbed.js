// Helpers for embedding demonstration videos (YouTube or direct files)

export function getYouTubeId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

export function isDirectVideo(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(String(url));
}

export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function hasDemoVideo(exercise) {
  return !!(exercise && (getYouTubeId(exercise.demo_video_url) || isDirectVideo(exercise.demo_video_url)));
}