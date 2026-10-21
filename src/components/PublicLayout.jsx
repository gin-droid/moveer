import { Link, Outlet, useLocation } from "react-router-dom";

export default function PublicLayout() {
  const isAboutPage = useLocation().pathname === "/about";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-sidebar pt-safe">
        <div className="max-w-[26rem] mx-auto w-full px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center justify-center">
            <img
              src={`${import.meta.env.BASE_URL}IMG_8121.JPG`}
              alt="moVeerAI"
              className="h-11 w-[82px] object-contain object-center"
            />
          </Link>
          {!isAboutPage && (
            <nav className="flex items-center gap-4 sm:gap-5 text-sm">
              <Link to="/gestione" className="text-muted-foreground hover:text-foreground transition-colors">Link utili</Link>
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">Cos'è</Link>
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">Accedi</Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[26rem] mx-auto w-full px-4 py-8 sm:py-12">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-sidebar pb-safe">
        <div className="max-w-[26rem] mx-auto w-full px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} moVeerAI — Analisi postura e tecnica</span>
          {!isAboutPage && (
            <nav className="flex items-center gap-4">
              <Link to="/gestione" className="hover:text-foreground transition-colors">Link utili</Link>
              <Link to="/about" className="hover:text-foreground transition-colors">Cos'è</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Accedi</Link>
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
}