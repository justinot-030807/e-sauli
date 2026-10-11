import { supabase } from '@/lib/supabase';

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  studentId: string;
  nickname: string;
  college: string;
}

interface SignInData {
  email: string;
  password: string;
}

export async function signUp(data: SignUpData) {
  const { email, password, fullName, studentId, nickname, college } = data;

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

  if (error) throw error;
  return authData;
}

export async function signIn(data: SignInData) {
  const { email, password } = data;

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return authData;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function acceptConsent() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ consent_accepted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
}
