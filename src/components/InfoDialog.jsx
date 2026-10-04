import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Standard informational dialog used in place of window.alert.
 *
 * @param {{open: boolean, onOpenChange: (open: boolean) => void, opts?: {title?: string, description?: string, closeLabel?: string}}} props
 */
export default function InfoDialog({ open, onOpenChange, opts = {} }) {
  const { title = "Avviso", description = "", closeLabel = "Chiudi" } = opts;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{closeLabel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}