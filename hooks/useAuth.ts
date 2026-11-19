import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { getStoredLocalSession, onLocalAuthChange, type LocalSessionData } from '@/services/auth';

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

function makeAuthState(session: Session | null, profile: Profile | null, demo: LocalSessionData | null): AuthState {
  const user = session?.user ?? demo?.user ?? null;
  profile ??= demo?.profile ?? null;
  return {
    session,
    user,
    profile,
    isLoading: false,
    isAuthenticated: !!user,
    isApproved: profile?.approval_status === 'approved',
    isAdmin: !!session && profile?.role === 'admin',
    isSuspended: profile?.is_suspended ?? false,
    hasConsented: !!profile?.consent_accepted_at,
  };
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
    if (!state.session) return;
    const userId = state.session.user.id;
    const profile = await fetchProfile(userId);
    setState((previous) => previous.session?.user.id === userId
      ? makeAuthState(previous.session, profile, null)
      : previous);
  }, [state.session, fetchProfile]);

  useEffect(() => {
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setState((previous) => previous.session?.user.id === session.user.id
          ? { ...previous, session, user: session.user }
          : previous);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        setState((previous) => previous.session?.user.id === session.user.id
          ? previous
          : { ...previous, isLoading: true });
      }
      const request = ++version;
      clearTimeout(timer);
      // Run Supabase queries after the auth callback releases its session lock.
      timer = setTimeout(async () => {
        const profile = session ? await fetchProfile(session.user.id) : null;
        const demo = session ? null : await getStoredLocalSession();
        if (version === request) setState(makeAuthState(session, profile, demo));
      }, 0);
    });

    const unsubscribeDemo = onLocalAuthChange((demo) => {
      setState((previous) => (previous.session || (!demo && previous.isLoading)) ? previous : makeAuthState(null, null, demo));
    });

    return () => {
      version++;
      clearTimeout(timer);
      subscription.unsubscribe();
      unsubscribeDemo();
    };
  }, [fetchProfile]);

  return { ...state, refreshProfile };
}
