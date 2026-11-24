export default function BrandLogo({ className = "" }) {
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className="font-display text-2xl font-bold tracking-tight text-white">
        mo<span className="text-primary">Veer</span><span className="text-primary/70">AI</span>
      </span>
      <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Analisi del movimento
      </span>
    </span>
  );
}
