import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check } from "lucide-react";

export default function MoreMenuSheet({ items, open, onOpenChange, activeTo, onSelect }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[72vh] flex flex-col bg-card border-sidebar-border rounded-t-3xl p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="font-display text-white text-base">Altre sezioni</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.to === activeTo;
            return (
              <button
                key={item.to}
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors select-none min-h-[48px] ${
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {active && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}