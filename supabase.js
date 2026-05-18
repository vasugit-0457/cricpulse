// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // Replace with your project URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';      // Replace with your anon key

export const supaClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth helpers ───
export async function getCurrentUser() {
  const { data: { user } } = await supaClient.auth.getUser();
  return user;
}

export async function signIn(email, password) {
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supaClient.auth.signOut();
}

export function onAuthStateChange(callback) {
  return supaClient.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });
}
