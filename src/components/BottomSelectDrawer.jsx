import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Check, ChevronDown } from "lucide-react";

/** @param {{value: string, onChange: (value: string) => void, options: Array<{value: string, label: string, sublabel?: string}>, title?: string, placeholder?: string, className?: string}} props */
export default function BottomSelectDrawer({
  value,
  onChange,
  options,
  title,
  placeholder,
  className,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors select-none ${className || ""}`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder || "Seleziona…"}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[72vh] max-h-[72dvh] flex flex-col bg-card border-sidebar-border rounded-t-3xl p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="font-display text-white text-base">
              {title || "Seleziona"}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-2">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors select-none min-h-[48px] ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{o.label}</div>
                    {o.sublabel && (
                      <div className="text-xs text-muted-foreground truncate">
                        {o.sublabel}
                      </div>
                    )}
                  </div>
                  {active && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nessuna opzione disponibile.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}