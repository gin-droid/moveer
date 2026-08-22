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
 * @param {boolean} open - whether the dialog is visible
 * @param {(open:boolean)=>void} onOpenChange - controlled open state setter
 * @param {()=>void} onConfirm - invoked when the user confirms
 * @param {object} opts
 * @param {string} [opts.title="Conferma"]
 * @param {string} [opts.description]
 * @param {string} [opts.confirmLabel="Elimina"]
 * @param {string} [opts.cancelLabel="Annulla"]
 * @param {boolean} [opts.destructive=true]
 * @param {boolean} [opts.loading=false]
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