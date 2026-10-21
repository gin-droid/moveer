import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { appApi } from '@/api/appApi';
import { isSupabaseConfigured, supabase } from '@/api/supabaseClient';

/** @type {React.Context<Record<string, any> | null>} */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);
  const loadedUserIdRef = useRef(null);
  const pendingCheckRef = useRef(null);

  const updateUser = (values) => {
    setUser((currentUser) => currentUser ? { ...currentUser, ...values } : currentUser);
  };

  useEffect(() => {
    checkAppState();
    if (!supabase) return undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        loadedUserIdRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      } else if (event === 'SIGNED_IN' && session.user?.id !== loadedUserIdRef.current) {
        // supabase-js also emits SIGNED_IN whenever the tab becomes visible again:
        // reload only when the signed-in user actually changed, so pages keep their state.
        window.setTimeout(() => checkUserAuth(), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(false);
    setAuthError(null);
    if (!isSupabaseConfigured) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) await checkUserAuth();
      else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    } catch (error) {
      setAuthError({ type: 'unknown', message: error.message || 'Errore di autenticazione' });
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = () => {
    if (!pendingCheckRef.current) {
      pendingCheckRef.current = loadUserAuth().finally(() => { pendingCheckRef.current = null; });
    }
    return pendingCheckRef.current;
  };

  const loadUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUserId = session?.user?.id;
      const [currentUser, entitlementResult] = await Promise.all([
        appApi.auth.me(),
        sessionUserId
          ? appApi.entities.UserEntitlement.filter({ user_id: sessionUserId }, '-created_date', 1)
            .then((rows) => ({ entitlement: rows?.[0] || null, failed: false }), () => ({ entitlement: null, failed: true }))
          : Promise.resolve({ entitlement: null, failed: true }),
      ]);
      if (!currentUser) {
        const missingSession = new Error('Sessione scaduta');
        // @ts-ignore
        missingSession.status = 401;
        throw missingSession;
      }
      const entitlement = currentUser.id === sessionUserId ? entitlementResult.entitlement : null;
      const isBlocked = entitlementResult.failed ? !!currentUser.blocked : !!entitlement?.blocked;
      if (isBlocked) {
        const isSuspended = currentUser.banned_until && new Date(currentUser.banned_until).getTime() > Date.now();
        setAuthError({
          type: isSuspended ? 'user_suspended' : 'user_blocked',
          message: isSuspended
            ? 'Il tuo account è stato sospeso da un amministratore.'
            : 'Il tuo account è stato bloccato da un amministratore.'
        });
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      loadedUserIdRef.current = currentUser.id;
      setAuthError(null);
      setUser({ ...currentUser, plan: entitlement?.plan || currentUser.plan });
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      loadedUserIdRef.current = null;
      setUser(null);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      const status = error?.status;
      if (status === 401 || status === 403 || error?.name === 'AuthSessionMissingError') {
        // Drop the invalid local session so the login page does not loop on it.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setAuthError({ type: 'auth_required', message: 'Sessione scaduta' });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      appApi.auth.logout(window.location.href);
    } else {
      appApi.auth.logout();
    }
  };

  const navigateToLogin = () => {
    appApi.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      updateUser,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};