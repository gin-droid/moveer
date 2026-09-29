import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ImagePlus, Loader2, Trash2, ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function LogoUploader({ currentLogo, onSaved }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato non supportato", description: "Carica un'immagine (PNG, JPG, SVG).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File troppo grande", description: "Massimo 2 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await base44.auth.updateMe({ logo_url: file_url });
      onSaved?.(file_url);
      toast({ title: "Logo aggiornato", description: "Il tuo logo comparirà nei report e nei PDF." });
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast({ title: "Caricamento fallito", description: err.message || "Riprova.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await base44.auth.updateMe({ logo_url: "" });
      onSaved?.("");
      toast({ title: "Logo rimosso" });
    } catch (err) {
      toast({ title: "Rimozione fallita", description: err.message || "Riprova.", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
          {currentLogo ? (
            <img src={currentLogo} alt="Logo" className="w-full h-full object-contain p-1" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            Il tuo logo appare nell'intestazione dei report e dei PDF esportati.
            Formati: PNG, JPG, SVG. Massimo 2 MB.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {currentLogo ? "Cambia logo" : "Carica logo"}
            </button>
            {currentLogo && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex items-center gap-2 border border-border text-muted-foreground hover:text-rose-400 hover:border-rose-500/40 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Rimuovi
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}