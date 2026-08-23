import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import storiaText from "../../docs/STORIA_SVILUPPO.txt?raw";

export default function DownloadStoriaButton() {
  const [busy, setBusy] = useState(false);

  const handleDownload = () => {
    setBusy(true);
    try {
      const blob = new Blob([storiaText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "STORIA_SVILUPPO.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className="inline-flex items-center gap-2 border border-foreground/20 hover:border-foreground/40 text-foreground font-medium text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Scarica cronologia progetto
    </button>
  );
}