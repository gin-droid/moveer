import React, { createContext, useState, useContext, useEffect } from 'react';
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

  const updateUser = (values) => {
    setUser((currentUser) => currentUser ? { ...currentUser, ...values } : currentUser);
  };

  useEffect(() => {
    checkAppState();
    if (!supabase) return undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
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

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await appApi.auth.me();
      let isBlocked = false;
      let entitlement = null;
      try {
        const entitlements = await appApi.entities.UserEntitlement.filter(
          { user_id: currentUser.id }, '-created_date', 1
        );
        entitlement = entitlements?.[0] || null;
        isBlocked = !!entitlement?.blocked;
      } catch {
        isBlocked = !!currentUser.blocked;
      }
      if (isBlocked) {
        setAuthError({
          type: 'user_blocked',
          message: 'Il tuo account è stato bloccato da un amministratore.'
        });
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      setUser({ ...currentUser, plan: entitlement?.plan || currentUser.plan });
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      if (error.status === 401 || error.status === 403) setAuthError({ type: 'auth_required', message: 'Sessione scaduta' });
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