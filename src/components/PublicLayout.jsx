import { Link, Outlet, useLocation } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

export default function PublicLayout() {
  const isAboutPage = useLocation().pathname === "/about";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-sidebar pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center justify-center">
            <BrandLogo className="min-w-[7rem]" />
          </Link>
          {!isAboutPage && (
            <nav className="flex items-center gap-4 sm:gap-5 text-sm">
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">Cos'è</Link>
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">Accedi</Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-sidebar pb-safe">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} moVeerAI — Analisi postura e tecnica</span>
          {!isAboutPage && (
            <nav className="flex items-center gap-4">
              <Link to="/about" className="hover:text-foreground transition-colors">Cos'è</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Accedi</Link>
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
}