import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, Link, useLocation, useOutlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Dumbbell, Video, FileText, Activity, TrendingUp,
  Users as UsersIcon, PlayCircle, User as UserIcon, ArrowLeft, Menu, Sparkles, UserCheck, CreditCard,
  Info, Mail,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/AuthContext";
import LogoutButton from "@/components/LogoutButton";
import SettingsDrawer from "@/components/SettingsDrawer";
import MoreMenuSheet from "@/components/MoreMenuSheet";

const primaryItems = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/esercizi", label: "Esercizi", icon: Dumbbell },
  { to: "/analizza", label: "Analizza", icon: Video, center: true },
  { to: "/report", label: "Report", icon: FileText },
];

const secondaryItems = [
  { to: "/video", label: "Video", icon: PlayCircle },
  { to: "/atleti", label: "Atleti", icon: UserCheck },
  { to: "/confronta", label: "Progressi", icon: TrendingUp },
  { to: "/mentore", label: "Mentore", icon: Sparkles },
  { to: "/abbonamento", label: "Abbonamento", icon: CreditCard },
  { to: "/utenti", label: "Utenti", icon: UsersIcon },
  { to: "/about", label: "Chi siamo", icon: Info },
  { to: "/contact", label: "Contatti", icon: Mail },
];

export default function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const visibleSecondary = isAdmin
    ? secondaryItems
    : secondaryItems.filter((i) => i.to !== "/utenti");
  const allItems = [...primaryItems, ...visibleSecondary];

  const navigate = useNavigate();
  const lastPaths = useRef({});

  const owningTab = (path) => {
    if (path === "/") return "/";
    let best = "/";
    for (const item of allItems) {
      const root = item.to;
      if (root === "/") continue;
      if (path === root || path.startsWith(root + "/")) best = root;
    }
    return best;
  };

  useEffect(() => {
    lastPaths.current[owningTab(location.pathname)] = location.pathname;
  }, [location.pathname]);

  const handleTabClick = (item) => {
    const active = owningTab(location.pathname);
    if (item.to === active) {
      navigate(item.to); // re-click active tab → reset to root
    } else {
      navigate(lastPaths.current[item.to] || item.to);
    }
  };

  const isExerciseDetail = /^\/esercizi\/[^/]+$/.test(location.pathname);
  const isReportDetail = /^\/report\/[^/]+$/.test(location.pathname);
  const isAthleteDetail = /^\/atleti\/[^/]+$/.test(location.pathname);
  const isDetail = isExerciseDetail || isReportDetail || isAthleteDetail;
  const isHome = location.pathname === "/";
  const showBack = !isHome;
  const detailTitle = isExerciseDetail
    ? "Dettaglio esercizio"
    : isReportDetail
    ? "Report analisi"
    : isAthleteDetail
    ? "Dettaglio atleta"
    : "";
  const currentTab = allItems.find((i) => i.to === owningTab(location.pathname));
  const pageTitle = detailTitle || currentTab?.label || "";

  const activeSecondary = visibleSecondary.some(
    (i) => i.to === owningTab(location.pathname)
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground flex overflow-x-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-7">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-semibold tracking-tight text-white">moVeerAI</div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">Postura &amp; Tecnica</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {allItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-6 py-5 border-t border-sidebar-border space-y-3">
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Analisi guidata dall'IA<br />per allenamenti più sicuri.
          </div>
          <LogoutButton className="text-muted-foreground hover:text-rose-300" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-sidebar backdrop-blur border-b border-sidebar-border pt-safe">
        <div className="flex items-center justify-between px-4 h-12">
          {showBack ? (
            <button
              onClick={() => (isDetail ? navigate(-1) : navigate("/"))}
              aria-label="Indietro"
              className="inline-flex items-center gap-2 text-foreground active:scale-95 transition-transform select-none"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-display font-semibold text-white text-sm">{pageTitle}</span>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-display font-semibold text-white">moVeerAI</span>
            </Link>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Impostazioni account"
            className="w-11 h-11 rounded-lg border border-sidebar-border bg-sidebar-accent flex items-center justify-center text-foreground active:scale-95 transition-transform select-none"
          >
            <UserIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 md:ml-64 pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0 pb-28 md:pb-0 min-h-screen min-h-[100dvh]">
        <div className="max-w-md md:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 overflow-x-hidden">
          {isMobile ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                className="w-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 pb-safe bg-sidebar border-t border-sidebar-border h-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-around h-[4.5rem]">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            if (item.center) {
              const active = owningTab(location.pathname) === item.to;
              return (
                <button
                  key={item.to}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabClick(item);
                  }}
                  className="flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] text-[10px] font-medium transition-colors select-none"
                >
                  <span className={`w-12 h-12 -mt-4 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                    active
                      ? "bg-primary shadow-lg shadow-primary/40"
                      : "bg-primary/15 shadow-md shadow-black/20"
                  }`}>
                    <Icon className={`w-6 h-6 ${active ? "text-primary-foreground" : "text-primary"}`} strokeWidth={2.5} />
                  </span>
                  <span className={active ? "text-primary" : "text-muted-foreground"}>{item.label}</span>
                </button>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={(e) => {
                  e.preventDefault();
                  handleTabClick(item);
                }}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] pb-1.5 text-[10px] font-medium transition-colors select-none ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] pb-1.5 text-[10px] font-medium transition-colors select-none ${
              activeSecondary ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
            Altro
          </button>
        </div>
      </nav>

      <MoreMenuSheet
        items={visibleSecondary}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        activeTo={owningTab(location.pathname)}
        onSelect={(item) => {
          setMoreOpen(false);
          handleTabClick(item);
        }}
      />

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}