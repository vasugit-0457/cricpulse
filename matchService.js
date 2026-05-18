// js/matchService.js
import { supaClient } from './supabase.js';

// ─── Fetch the current live match ───
export async function getLiveMatch() {
  const { data, error } = await supaClient
    .from('matches')
    .select('*')
    .eq('status', 'live')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[matchService] getLiveMatch error:', error.message);
    return null;
  }
  return data;
}

// ─── Fetch all matches (for match selector) ───
export async function getAllMatches() {
  const { data, error } = await supaClient
    .from('matches')
    .select('id, team1, team2, status, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[matchService] getAllMatches error:', error.message);
    return [];
  }
  return data;
}

// ─── Fetch a single match by ID ───
export async function getMatchById(matchId) {
  const { data, error } = await supaClient
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error) {
    console.error('[matchService] getMatchById error:', error.message);
    return null;
  }
  return data;
}

// ─── Subscribe to real-time score updates ───
// onUpdate(newMatchData) is called on every score change
export function subscribeToMatch(matchId, onUpdate) {
  const channel = supaClient
    .channel('match_realtime_' + matchId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`
      },
      (payload) => {
        console.log('[matchService] Score updated:', payload.new);
        onUpdate(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('[matchService] Realtime status:', status);
    });

  return channel; // store this to unsubscribe later
}

// ─── Unsubscribe from match updates ───
export function unsubscribeFromMatch(channel) {
  if (supaClient && channel) {
    supaClient.removeChannel(channel);
    console.log('[matchService] Realtime channel closed');
  }
}

// ─── Fetch ball-by-ball commentary for a match ───
export async function getCommentary(matchId, limit = 20) {
  const { data, error } = await supaClient
    .from('commentary')
    .select('*')
    .eq('match_id', matchId)
    .order('ball_number', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[matchService] getCommentary error:', error.message);
    return [];
  }
  return data;
}

// ─── Subscribe to new commentary balls ───
export function subscribeToCommentary(matchId, onNewBall) {
  const channel = supaClient
    .channel('commentary_realtime_' + matchId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'commentary',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        console.log('[matchService] New ball:', payload.new);
        onNewBall(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// ─── Fetch key moments for a match ───
export async function getKeyMoments(matchId) {
  const { data, error } = await supaClient
    .from('key_moments')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[matchService] getKeyMoments error:', error.message);
    return [];
  }
  return data;
}

// ─── Subscribe to new key moments ───
export function subscribeToMoments(matchId, onNewMoment) {
  const channel = supaClient
    .channel('moments_realtime_' + matchId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'key_moments',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => onNewMoment(payload.new)
    )
    .subscribe();

  return channel;
}

// ─── Admin: Update match score (only admin role should call this) ───
export async function adminUpdateScore(matchId, updates) {
  // updates = { score1, score2, overs, win_prob_team1, current_over_balls, status }
  const { data, error } = await supaClient
    .from('matches')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    console.error('[matchService] adminUpdateScore error:', error.message);
    return null;
  }
  return data;
}

// ─── Admin: Add a commentary ball ───
export async function adminAddBall(matchId, ballData) {
  // ballData = { over_number, ball_number, bowler, batsman, run_type, runs, commentary_text }
  const { data, error } = await supaClient
    .from('commentary')
    .insert({ match_id: matchId, ...ballData })
    .select()
    .single();

  if (error) {
    console.error('[matchService] adminAddBall error:', error.message);
    return null;
  }
  return data;
}

// ─── Admin: Add a key moment ───
export async function adminAddMoment(matchId, momentData) {
  // momentData = { title, description, type }  type: 'six' | 'wicket' | 'milestone' | 'general'
  const { data, error } = await supaClient
    .from('key_moments')
    .insert({ match_id: matchId, ...momentData })
    .select()
    .single();

  if (error) {
    console.error('[matchService] adminAddMoment error:', error.message);
    return null;
  }
  return data;
}
