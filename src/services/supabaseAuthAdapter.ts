import { getSupabaseClient } from './supabaseClient';

type SignUpParams = { email: string; password: string; redirectTo?: string };
type SignInParams = { email: string; password: string };

export async function signUp(params: SignUpParams) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email: params.email,
    password: params.password,
    options: params.redirectTo
      ? { emailRedirectTo: params.redirectTo }
      : undefined,
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signIn(params: SignInParams) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getSession() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}
