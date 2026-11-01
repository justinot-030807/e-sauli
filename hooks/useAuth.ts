import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import {
  getStoredLocalSession,
  onLocalAuthChange,
  setStoredLocalSession,
  type LocalSessionData,
} from '@/services/auth';

interface AuthState {
  session: Session | null;
  user: User | { id: string; email?: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  hasConsented: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    isApproved: false,
    isAdmin: false,
    isSuspended: false,
    hasConsented: false,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as Profile;
    } catch (err) {
      console.warn('Error fetching profile from Supabase:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    // Check local session first
    const local = await getStoredLocalSession();
    if (local && local.user.id === state.user.id) {
      setState((prev) => ({
        ...prev,
        profile: local.profile,
        isApproved: local.profile.approval_status === 'approved',
        isAdmin: local.profile.role === 'admin',
        isSuspended: local.profile.is_suspended,
        hasConsented: !!local.profile.consent_accepted_at,
      }));
      return;
    }

    const profile = await fetchProfile(state.user.id);
    if (profile) {
      setState((prev) => ({
        ...prev,
        profile,
        isApproved: profile.approval_status === 'approved',
        isAdmin: profile.role === 'admin',
        isSuspended: profile.is_suspended,
        hasConsented: !!profile.consent_accepted_at,
      }));
    }
  }, [state.user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial check: Supabase or Local Stored Session
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (isMounted) {
            setState({
              session,
              user: session.user,
              profile,
              isLoading: false,
              isAuthenticated: true,
              isApproved: profile?.approval_status === 'approved',
              isAdmin: profile?.role === 'admin',
              isSuspended: profile?.is_suspended ?? false,
              hasConsented: !!profile?.consent_accepted_at,
            });
          }
          return;
        }

        const local = await getStoredLocalSession();
        if (local && isMounted) {
          setState({
            session: null,
            user: local.user,
            profile: local.profile,
            isLoading: false,
            isAuthenticated: true,
            isApproved: local.profile.approval_status === 'approved',
            isAdmin: local.profile.role === 'admin',
            isSuspended: local.profile.is_suspended ?? false,
            hasConsented: !!local.profile.consent_accepted_at,
          });
          return;
        }

        if (isMounted) {
          setState({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            isApproved: false,
            isAdmin: false,
            isSuspended: false,
            hasConsented: false,
          });
        }
      } catch (err) {
        console.warn('Error during initAuth:', err);
        if (isMounted) {
          setState({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            isApproved: false,
            isAdmin: false,
            isSuspended: false,
            hasConsented: false,
          });
        }
      }
    }

    initAuth();

    // 2. Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          session,
          user: session.user,
          profile,
          isLoading: false,
          isAuthenticated: true,
          isApproved: profile?.approval_status === 'approved',
          isAdmin: profile?.role === 'admin',
          isSuspended: profile?.is_suspended ?? false,
          hasConsented: !!profile?.consent_accepted_at,
        });
      } else {
        const local = await getStoredLocalSession();
        if (local) {
          setState({
            session: null,
            user: local.user,
            profile: local.profile,
            isLoading: false,
            isAuthenticated: true,
            isApproved: local.profile.approval_status === 'approved',
            isAdmin: local.profile.role === 'admin',
            isSuspended: local.profile.is_suspended ?? false,
            hasConsented: !!local.profile.consent_accepted_at,
          });
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            isApproved: false,
            isAdmin: false,
            isSuspended: false,
            hasConsented: false,
          });
        }
      }
    });

    // 3. Listen to Local Session events (e.g. 1-Tap Demo sign-in / sign-out)
    const unsubLocal = onLocalAuthChange((localSession) => {
      if (!isMounted) return;
      if (localSession) {
        setState({
          session: null,
          user: localSession.user,
          profile: localSession.profile,
          isLoading: false,
          isAuthenticated: true,
          isApproved: localSession.profile.approval_status === 'approved',
          isAdmin: localSession.profile.role === 'admin',
          isSuspended: localSession.profile.is_suspended ?? false,
          hasConsented: !!localSession.profile.consent_accepted_at,
        });
      } else {
        setState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
          isApproved: false,
          isAdmin: false,
          isSuspended: false,
          hasConsented: false,
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      unsubLocal();
    };
  }, [fetchProfile]);

  return { ...state, refreshProfile };
}
