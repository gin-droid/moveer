export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

const VIDEO_EXTS = [
  "mp4", "mov", "webm", "m4v", "3gp", "3g2", "ogg", "ogv", "avi", "mkv", "ts", "mpeg", "mpg", "wmv",
];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];
// HEIC/HEIF are not decodable by canvas in most browsers
const UNSUPPORTED_EXTS = ["heic", "heif", "heics"];

export function getFileExtension(file) {
  const name = (file.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

// Videos shared via email/WhatsApp often arrive with an empty or generic MIME
// (application/octet-stream). Detect them by extension so they still validate.
export function isVideoFile(file) {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("video/")) return true;
  const ext = getFileExtension(file);
  // Forwarded media (email/WhatsApp/Telegram) often arrives with an empty,
  // generic, or audio/* MIME (e.g. round video notes tagged audio/webm).
  // Trust the extension in those cases.
  const generic = !t || t === "application/octet-stream" || t === "binary/octet-stream" || t.startsWith("audio/");
  return generic && VIDEO_EXTS.includes(ext);
}

export function isImageFile(file) {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (!t || t === "application/octet-stream" || t === "binary/octet-stream") {
    return IMAGE_EXTS.includes(getFileExtension(file));
  }
  return false;
}

export function validateMediaFile(file) {
  if (!file) return "Nessun file selezionato.";
  if (!file.size) return "File vuoto o danneggiato. Riprova a scaricarlo e caricarlo.";
  const ext = getFileExtension(file);
  if (UNSUPPORTED_EXTS.includes(ext)) {
    return "Formato HEIC non supportato dal browser. Converti l'immagine in JPG o PNG.";
  }
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_SIZE) return `File troppo grande (max ${formatFileSize(MAX_VIDEO_SIZE)}).`;
    return null;
  }
  if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_SIZE) return `File troppo grande (max ${formatFileSize(MAX_IMAGE_SIZE)}).`;
    return null;
  }
  return "Formato non supportato. Carica un video (MP4, MOV, WEBM) o un'immagine.";
}

/**
 * Extracts key frames from a video file as JPEG File objects.
 * Uses a canvas to capture frames at evenly-spaced timestamps.
 * Robust to: stuck seeks (per-frame timeout), Infinity duration (some webm),
 * detached-element decoding limits (Safari/iOS), and missing `loadeddata`.
 */
export async function extractVideoFrames(file, numFrames = 3) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    // Some browsers (Safari/iOS) won't decode frames for a detached video element.
    // Attach it hidden to the DOM so canvas capture works everywhere.
    video.style.cssText =
      "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0;z-index:-1;";

    const url = URL.createObjectURL(file);
    let settled = false;
    let started = false;
    let cleaned = false;

    const cleanup = () => {
      if (!cleaned) {
        cleaned = true;
        URL.revokeObjectURL(url);
        if (video.parentNode) video.parentNode.removeChild(video);
      }
    };

    const globalTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          "Timeout nell'estrazione dei frame del video. Prova con un file più leggero o in formato MP4/H.264."
        )
      );
    }, 45000);

    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(globalTimeout);
      cleanup();
      reject(new Error(msg));
    };

    video.addEventListener("error", () =>
      fail("Errore nel caricamento del video. Formato non supportato o file danneggiato.")
    );

    const MAX_DIM = 720;

    const captureAt = (t, canvas, ctx) =>
      new Promise((resolveFrame, rejectFrame) => {
        let done = false;
        const to = setTimeout(() => {
          if (!done) {
            done = true;
            video.removeEventListener("seeked", onSeeked);
            rejectFrame(new Error("seek timeout"));
          }
        }, 8000);

        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          const w = video.videoWidth || 720;
          const h = video.videoHeight || 720;
          const scale = Math.min(1, MAX_DIM / Math.max(w, h));
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch (e) {
            if (!done) {
              done = true;
              clearTimeout(to);
              rejectFrame(new Error("draw failed"));
            }
            return;
          }
          canvas.toBlob(
            (blob) => {
              if (!done) {
                done = true;
                clearTimeout(to);
                if (blob)
                  resolveFrame(
                    new File([blob], `frame_${Math.round(t * 1000)}.jpg`, {
                      type: "image/jpeg",
                    })
                  );
                else rejectFrame(new Error("capture failed"));
              }
            },
            "image/jpeg",
            0.85
          );
        };

        video.addEventListener("seeked", onSeeked, { once: true });
        try {
          // Nudge if we're already at the target time (a no-op seek won't fire `seeked`)
          if (Math.abs(video.currentTime - t) < 0.05) {
            video.currentTime = t + 0.1 > video.duration ? t - 0.1 : t + 0.1;
          }
          video.currentTime = t;
        } catch (e) {
          if (!done) {
            done = true;
            clearTimeout(to);
            video.removeEventListener("seeked", onSeeked);
            rejectFrame(new Error("seek failed"));
          }
        }
      });

    const onReady = async () => {
      if (started || settled) return;
      started = true;

      let duration = video.duration;
      // Fix Infinity/NaN duration (common with some webm streams)
      if (!duration || !isFinite(duration)) {
        await new Promise((res) => {
          const onDur = () => res();
          video.addEventListener("durationchange", onDur, { once: true });
          try {
            video.currentTime = 1e101;
          } catch (e) {
            res();
          }
          setTimeout(res, 1500);
        });
        duration = video.duration;
      }
      if (!duration || !isFinite(duration)) {
        fail("Impossibile leggere la durata del video.");
        return;
      }

      const timestamps = [];
      for (let i = 0; i < numFrames; i++) {
        timestamps.push((duration * (i + 1)) / (numFrames + 1));
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const frames = [];

      for (let i = 0; i < timestamps.length; i++) {
        try {
          const frame = await captureAt(timestamps[i], canvas, ctx);
          frames.push(frame);
        } catch (e) {
          // skip failed frame, continue with others
        }
      }

      // Fallback: if every seek failed, try to capture the very first frame
      if (frames.length === 0) {
        try {
          await new Promise((res) => {
            const onS = () => res();
            video.addEventListener("seeked", onS, { once: true });
            video.currentTime = 0;
            setTimeout(res, 4000);
          });
          const w = video.videoWidth || 720;
          const h = video.videoHeight || 720;
          const scale = Math.min(1, MAX_DIM / Math.max(w, h));
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise((res) =>
            canvas.toBlob(res, "image/jpeg", 0.85)
          );
          if (blob)
            frames.push(new File([blob], "frame_0.jpg", { type: "image/jpeg" }));
        } catch (e) {
          // ignore
        }
      }

      if (settled) return;
      settled = true;
      clearTimeout(globalTimeout);
      cleanup();
      resolve(frames);
    };

    // Start once the first frame is available. Some browsers fire `canplay`
    // without `loadeddata`, so accept either — guarded by `started`.
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });

    document.body.appendChild(video);
    video.src = url;
    video.load();
  });
}