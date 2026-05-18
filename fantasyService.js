// js/fantasyService.js
import { supaClient } from './supabase.js';

// ─── Fetch top fans leaderboard ───
export async function getLeaderboard(limit = 50) {
  const { data, error } = await supaClient
    .from('fan_points')
    .select('user_id, display_name, total_points, match_points')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fantasyService] getLeaderboard error:', error.message);
    return [];
  }
  return data;
}

// ─── Fetch current user rank + points ───
export async function getUserRank(userId) {
  // Get user points
  const { data: myData } = await supaClient
    .from('fan_points')
    .select('total_points, match_points, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!myData) return { rank: null, points: 0, matchPoints: 0 };

  // Count users with more points to determine rank
  const { count } = await supaClient
    .from('fan_points')
    .select('*', { count: 'exact', head: true })
    .gt('total_points', myData.total_points);

  return {
    rank: (count || 0) + 1,
    points: myData.total_points,
    matchPoints: myData.match_points,
    displayName: myData.display_name
  };
}

// ─── Subscribe to leaderboard changes ───
export function subscribeToLeaderboard(onUpdate) {
  const channel = supaClient
    .channel('leaderboard_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'fan_points'
      },
      (payload) => onUpdate(payload)
    )
    .subscribe();

  return channel;
}

// ─── Fetch fantasy player stats for a match ───
export async function getFantasyPlayers(matchId) {
  const { data, error } = await supaClient
    .from('fantasy_players')
    .select('*')
    .eq('match_id', matchId)
    .order('points', { ascending: false });

  if (error) {
    console.error('[fantasyService] getFantasyPlayers error:', error.message);
    return [];
  }
  return data;
}

// ─── Admin: Update a player's fantasy points ───
export async function adminUpdatePlayerPoints(matchId, playerName, statUpdate) {
  // statUpdate = { runs, wickets, catches, points }
  const { data, error } = await supaClient
    .from('fantasy_players')
    .upsert({
      match_id: matchId,
      player_name: playerName,
      ...statUpdate
    }, { onConflict: 'match_id, player_name' })
    .select()
    .single();

  if (error) {
    console.error('[fantasyService] adminUpdatePlayerPoints error:', error.message);
    return null;
  }
  return data;
}
