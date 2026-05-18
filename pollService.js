// js/pollService.js
import { supaClient } from './supabase.js';

// ─── Fetch all active polls for a match ───
export async function getPollsByMatch(matchId) {
  const { data, error } = await supaClient
    .from('polls')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[pollService] getPollsByMatch error:', error.message);
    return [];
  }
  return data;
}

// ─── Check if current user already voted on a poll ───
export async function getUserVote(pollId, userId) {
  const { data, error } = await supaClient
    .from('poll_votes')
    .select('option_index')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .maybeSingle(); // returns null if no vote, not an error

  if (error) {
    console.error('[pollService] getUserVote error:', error.message);
    return null;
  }
  return data; // { option_index: 0 } or null
}

// ─── Submit a vote ───
// Returns { success, updatedPoll, error }
export async function submitVote(pollId, userId, optionIndex) {
  // Step 1: Check if already voted (prevent duplicate votes)
  const existing = await getUserVote(pollId, userId);
  if (existing !== null) {
    return { success: false, error: 'You have already voted on this poll.' };
  }

  // Step 2: Insert the vote record
  const { error: voteError } = await supaClient
    .from('poll_votes')
    .insert({ poll_id: pollId, user_id: userId, option_index: optionIndex });

  if (voteError) {
    console.error('[pollService] submitVote insert error:', voteError.message);
    return { success: false, error: voteError.message };
  }

  // Step 3: Increment the vote count in polls.votes JSONB array
  // Fetch current votes first
  const { data: poll, error: fetchError } = await supaClient
    .from('polls')
    .select('votes, total_votes')
    .eq('id', pollId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const updatedVotes = [...poll.votes];
  updatedVotes[optionIndex] = (updatedVotes[optionIndex] || 0) + 1;
  const updatedTotal = (poll.total_votes || 0) + 1;

  const { data: updatedPoll, error: updateError } = await supaClient
    .from('polls')
    .update({ votes: updatedVotes, total_votes: updatedTotal })
    .eq('id', pollId)
    .select()
    .single();

  if (updateError) {
    console.error('[pollService] submitVote update error:', updateError.message);
    return { success: false, error: updateError.message };
  }

  return { success: true, updatedPoll };
}

// ─── Subscribe to real-time poll vote updates ───
// Fires whenever any user votes — keeps all fans in sync
export function subscribeToPoll(pollId, onUpdate) {
  const channel = supaClient
    .channel('poll_realtime_' + pollId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `id=eq.${pollId}`
      },
      (payload) => {
        console.log('[pollService] Poll updated:', payload.new);
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// ─── Subscribe to ALL polls for a match at once ───
export function subscribeToMatchPolls(matchId, onAnyPollUpdate) {
  const channel = supaClient
    .channel('polls_match_' + matchId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => onAnyPollUpdate(payload.new)
    )
    .subscribe();

  return channel;
}

// ─── Unsubscribe ───
export function unsubscribeFromPoll(channel) {
  if (supaClient && channel) {
    supaClient.removeChannel(channel);
  }
}

// ─── Admin: Create a new poll ───
export async function adminCreatePoll(matchId, question, options, closesAt) {
  // options = ['Option A', 'Option B', 'Option C']
  // closesAt = ISO date string e.g. new Date(Date.now() + 10*60*1000).toISOString()
  const votes = new Array(options.length).fill(0);

  const { data, error } = await supaClient
    .from('polls')
    .insert({
      match_id: matchId,
      question,
      options,   // jsonb array
      votes,     // jsonb array of zeros
      total_votes: 0,
      closes_at: closesAt
    })
    .select()
    .single();

  if (error) {
    console.error('[pollService] adminCreatePoll error:', error.message);
    return null;
  }
  return data;
}

// ─── Admin: Close a poll manually ───
export async function adminClosePoll(pollId) {
  const { data, error } = await supaClient
    .from('polls')
    .update({ closes_at: new Date().toISOString() })
    .eq('id', pollId)
    .select()
    .single();

  if (error) {
    console.error('[pollService] adminClosePoll error:', error.message);
    return null;
  }
  return data;
}
