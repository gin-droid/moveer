import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from '@/components/AppLayout';
const Home = lazy(() => import('@/pages/Home'));
const Exercises = lazy(() => import('@/pages/Exercises'));
const ExerciseDetail = lazy(() => import('@/pages/ExerciseDetail'));
const Demos = lazy(() => import('@/pages/Demos'));
const Analyze = lazy(() => import('@/pages/Analyze'));
const Reports = lazy(() => import('@/pages/Reports'));
const ReportDetail = lazy(() => import('@/pages/ReportDetail'));
const Compare = lazy(() => import('@/pages/Compare'));
const Users = lazy(() => import('@/pages/Users'));
const Athletes = lazy(() => import('@/pages/Athletes'));
const AthleteDetail = lazy(() => import('@/pages/AthleteDetail'));
const Mentor = lazy(() => import('@/pages/Mentor'));
const Monetization = lazy(() => import('@/pages/Monetization'));
const Subscription = lazy(() => import('@/pages/Subscription'));
const About = lazy(() => import('@/pages/About'));
import PublicLayout from '@/components/PublicLayout';
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import { appPath } from '@/lib/appPath';

const Router = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

const AppLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <AppLoading />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'user_blocked') {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center mx-auto">
              <span className="text-2xl">⛔</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-white">Account bloccato</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Il tuo account è stato bloccato da un amministratore.
              Per assistenza contatta info@moveer.ai
            </p>
            <button
              onClick={() => { window.location.href = appPath('/login'); }}
              className="inline-flex items-center justify-center bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-xl"
            >
              Esci
            </button>
          </div>
        </div>
      );
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<PublicLayout />}>
        <Route path="/about" element={<About />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/esercizi" element={<Exercises />} />
          <Route path="/esercizi/:id" element={<ExerciseDetail />} />
          <Route path="/video" element={<Demos />} />
          <Route path="/analizza" element={<Analyze />} />
          <Route path="/report" element={<Reports />} />
          <Route path="/report/:id" element={<ReportDetail />} />
          <Route path="/confronta" element={<Compare />} />
          <Route path="/utenti" element={<Users />} />
          <Route path="/atleti" element={<Athletes />} />
          <Route path="/atleti/:id" element={<AthleteDetail />} />
          <Route path="/mentore" element={<Mentor />} />
          <Route path="/monetizzazione" element={<Monetization />} />
          <Route path="/abbonamento" element={<Subscription />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename={Router === BrowserRouter ? import.meta.env.BASE_URL : undefined}>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App