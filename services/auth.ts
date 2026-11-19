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

function parseDemoSession(raw: string | null): LocalSessionData | null {
  if (!raw) return null;
  const { user } = JSON.parse(raw) as LocalSessionData;
  if (user?.id === DEMO_STUDENT_PROFILE.id && user.email === 'maria@marsu.edu.ph') {
    return { user, profile: DEMO_STUDENT_PROFILE };
  }
  if (user?.id === DEMO_ADMIN_PROFILE.id && user.email === 'admin@marsu.edu.ph') {
    return { user, profile: DEMO_ADMIN_PROFILE };
  }
  return null;
}

// Storage helpers
export async function getStoredLocalSession(): Promise<LocalSessionData | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_SESSION_KEY);
        return parseDemoSession(raw);
      }
      return null;
    }
    const raw = await SecureStore.getItemAsync(LOCAL_SESSION_KEY);
    return parseDemoSession(raw);
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

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, student_id: studentId, nickname, college } },
  });
  if (error) throw error;
  return authData;
}

export async function signIn(data: SignInData) {
  const { data: authData, error } = await supabase.auth.signInWithPassword(data);
  if (error) throw error;
  if (!authData.session) throw new Error('Hindi nakapag-login. Pakisubukang muli.');
  await clearStoredLocalSession();
  return authData;
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
