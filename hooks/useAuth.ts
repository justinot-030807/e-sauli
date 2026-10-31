import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  hasConsented: boolean;
}

export function useAuth() {
  const defaultProfile: Profile = {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Maria Santos',
    student_id: '2023-10021',
    nickname: 'MariaS',
    college: 'College of Information and Computing Sciences',
    role: 'student',
    approval_status: 'approved',
    consent_accepted_at: new Date().toISOString(),
    points: 245,
    returns_count: 12,
    is_suspended: false,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };

  const [state, setState] = useState<AuthState>({
    session: { access_token: 'active_session', user: { id: defaultProfile.id } } as any,
    user: { id: defaultProfile.id, email: 'maria@marsu.edu.ph' } as any,
    profile: defaultProfile,
    isLoading: false,
    isAuthenticated: true,
    isApproved: true,
    isAdmin: false,
    isSuspended: false,
    hasConsented: true,
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
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
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
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return { ...state, refreshProfile };
}
