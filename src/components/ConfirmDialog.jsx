import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Standard confirm dialog used across the app in place of window.confirm.
 *
 * @param {{open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void, opts?: {title?: string, description?: string, confirmLabel?: string, cancelLabel?: string, destructive?: boolean, loading?: boolean}}} props
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  opts = {},
}) {
  const {
    title = "Conferma",
    description,
    confirmLabel = "Elimina",
    cancelLabel = "Annulla",
    destructive = true,
    loading = false,
  } = opts;

  return (
    <AlertDialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={destructive ? "bg-rose-600 text-white hover:bg-rose-700" : undefined}
          >
            {loading ? "Eliminazione…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}