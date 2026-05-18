// js/reactionService.js
import { supaClient } from './supabase.js';
import { awardPoints } from './predictionService.js';

// ─── Submit a fan reaction ───
export async function submitReaction(matchId, userId, emoji) {
  const { data, error } = await supaClient
    .from('reactions')
    .insert({ match_id: matchId, user_id: userId, emoji });

  if (error) {
    console.error('[reactionService] submitReaction error:', error.message);
    return { success: false };
  }

  // Award 5 points per reaction
  await awardPoints(userId, 5, 'reaction');
  return { success: true };
}

// ─── Get reaction counts for current match ───
export async function getReactionCounts(matchId) {
  const { data, error } = await supaClient
    .from('reactions')
    .select('emoji')
    .eq('match_id', matchId);

  if (error) {
    console.error('[reactionService] getReactionCounts error:', error.message);
    return {};
  }

  // Count each emoji
  return data.reduce((acc, row) => {
    acc[row.emoji] = (acc[row.emoji] || 0) + 1;
    return acc;
  }, {});
}

// ─── Subscribe to live reaction counts ───
// Fires on every new reaction — update the counts in real time
export function subscribeToReactions(matchId, onNewReaction) {
  const channel = supaClient
    .channel('reactions_realtime_' + matchId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'reactions',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => onNewReaction(payload.new)
    )
    .subscribe();

  return channel;
}
