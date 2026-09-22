import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";

/**
 * Modal di anteprima PDF con iframe + pulsante di download.
 * Funziona completamente offline (blob URL locale).
 */
export default function PdfPreviewModal({ open, onOpenChange, blobUrl, fileName }) {
  if (!blobUrl) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "documento.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-3xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center gap-3 space-y-0 flex-none">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Scarica
          </button>
          <DialogTitle className="font-display text-white text-sm truncate flex-1">
            {fileName || "PDF"}
          </DialogTitle>
        </DialogHeader>
        <iframe
          src={blobUrl}
          title="Anteprima PDF"
          className="flex-1 w-full bg-white"
          style={{ minHeight: 0 }}
        />
      </DialogContent>
    </Dialog>
  );
}