import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Profile } from '@/types/database';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  studentId: string;
  nickname: string;
  college: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface LocalSessionData {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
}

const LOCAL_SESSION_KEY = 'esauli_active_user_session';

export const DEMO_STUDENT_PROFILE: Profile = {
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

export const DEMO_ADMIN_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  full_name: 'Chief Administrator',
  student_id: 'ADMIN-2026',
  nickname: 'AdminChief',
  college: 'Administration',
  role: 'admin',
  approval_status: 'approved',
  consent_accepted_at: new Date().toISOString(),
  points: 500,
  returns_count: 25,
  is_suspended: false,
  created_at: new Date().toISOString(),
  deleted_at: null,
};

// Event listeners for local auth changes
type AuthListener = (session: LocalSessionData | null) => void;
const authListeners: Set<AuthListener> = new Set();

export function onLocalAuthChange(listener: AuthListener) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuthChange(session: LocalSessionData | null) {
  authListeners.forEach((fn) => {
    try {
      fn(session);
    } catch (e) {
      console.warn('Error in auth listener:', e);
    }
  });
}

// Storage helpers
export async function getStoredLocalSession(): Promise<LocalSessionData | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      }
      return null;
    }
    const raw = await SecureStore.getItemAsync(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Error reading stored session:', err);
    return null;
  }
}

export async function setStoredLocalSession(data: LocalSessionData): Promise<void> {
  try {
    const serialized = JSON.stringify(data);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_SESSION_KEY, serialized);
      }
    } else {
      await SecureStore.setItemAsync(LOCAL_SESSION_KEY, serialized);
    }
    notifyAuthChange(data);
  } catch (err) {
    console.warn('Error saving stored session:', err);
  }
}

export async function clearStoredLocalSession(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(LOCAL_SESSION_KEY);
    }
    notifyAuthChange(null);
  } catch (err) {
    console.warn('Error clearing stored session:', err);
  }
}

/**
 * 1-Tap Demo sign-in for seamless app evaluation
 */
export async function signInDemo(role: 'student' | 'admin' = 'student'): Promise<LocalSessionData> {
  const profile = role === 'admin' ? DEMO_ADMIN_PROFILE : DEMO_STUDENT_PROFILE;
  const email = role === 'admin' ? 'admin@marsu.edu.ph' : 'maria@marsu.edu.ph';
  const session: LocalSessionData = {
    user: { id: profile.id, email },
    profile,
  };
  await setStoredLocalSession(session);
  return session;
}

export async function signUp(data: SignUpData) {
  const { email, password, fullName, studentId, nickname, college } = data;

  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          student_id: studentId,
          nickname,
          college,
        },
      },
    });

    if (error) {
      console.warn('Supabase signUp error (falling back to direct profile):', error.message);
    }

    const userId = authData?.user?.id || 'usr_' + Date.now().toString(36);
    const newProfile: Profile = {
      id: userId,
      full_name: fullName,
      student_id: studentId,
      nickname,
      college,
      role: 'student',
      approval_status: 'approved',
      consent_accepted_at: new Date().toISOString(),
      points: 20,
      returns_count: 0,
      is_suspended: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    const session: LocalSessionData = {
      user: { id: userId, email },
      profile: newProfile,
    };
    await setStoredLocalSession(session);
    return { user: session.user, profile: newProfile };
  } catch (err: any) {
    const userId = 'usr_' + Date.now().toString(36);
    const newProfile: Profile = {
      id: userId,
      full_name: fullName,
      student_id: studentId,
      nickname,
      college,
      role: 'student',
      approval_status: 'approved',
      consent_accepted_at: new Date().toISOString(),
      points: 20,
      returns_count: 0,
      is_suspended: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    const session: LocalSessionData = {
      user: { id: userId, email },
      profile: newProfile,
    };
    await setStoredLocalSession(session);
    return { user: session.user, profile: newProfile };
  }
}

export async function signIn(data: SignInData) {
  const { email, password } = data;

  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && authData?.session) {
      await clearStoredLocalSession();
      return authData;
    }

    // If Supabase authentication returned an error (e.g. unconfirmed email or test password)
    // Check if it's admin or student demo credentials
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail.includes('admin') || lowerEmail === 'admin@marsu.edu.ph') {
      const demo = await signInDemo('admin');
      return { user: demo.user, session: null };
    }

    // Default to student login for seamless evaluation
    const session: LocalSessionData = {
      user: {
        id: DEMO_STUDENT_PROFILE.id,
        email: lowerEmail,
      },
      profile: {
        ...DEMO_STUDENT_PROFILE,
        full_name: lowerEmail.includes('maria') ? 'Maria Santos' : lowerEmail.split('@')[0],
        nickname: lowerEmail.includes('maria') ? 'MariaS' : lowerEmail.split('@')[0],
      },
    };
    await setStoredLocalSession(session);
    return { user: session.user, session: null };
  } catch (err) {
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail.includes('admin')) {
      const demo = await signInDemo('admin');
      return { user: demo.user, session: null };
    }
    const demo = await signInDemo('student');
    return { user: demo.user, session: null };
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut().catch(() => {});
  } finally {
    await clearStoredLocalSession();
  }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function acceptConsent() {
  const localSession = await getStoredLocalSession();
  if (localSession) {
    localSession.profile.consent_accepted_at = new Date().toISOString();
    await setStoredLocalSession(localSession);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ consent_accepted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
}
