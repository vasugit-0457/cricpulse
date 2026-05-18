// js/app.js  — Main entry point
import { supaClient, getCurrentUser, onAuthStateChange } from './supabase.js';
import { AppState } from './state.js';
import { getLiveMatch, subscribeToMatch, subscribeToCommentary, subscribeToMoments } from './matchService.js';
import { getPollsByMatch, getUserVote, subscribeToMatchPolls } from './pollService.js';
import { getUserRank, getLeaderboard, subscribeToLeaderboard } from './fantasyService.js';
import { getReactionCounts, subscribeToReactions } from './reactionService.js';

// ─── Bootstrap the app ───
async function init() {
  // 1. Get logged-in user
  AppState.currentUser = await getCurrentUser();

  // 2. Load live match data
  const match = await getLiveMatch();
  if (!match) {
    console.warn('No live match found.');
    return;
  }
  AppState.match = match;
  AppState.currentMatchId = match.id;

  // 3. Render UI with loaded data
  renderMatch(match);

  // 4. Load supporting data in parallel
  const [polls, reactions, leaderboard, rank] = await Promise.all([
    getPollsByMatch(match.id),
    getReactionCounts(match.id),
    getLeaderboard(50),
    AppState.currentUser ? getUserRank(AppState.currentUser.id) : null
  ]);

  AppState.polls = polls;
  AppState.reactions = reactions;
  AppState.leaderboard = leaderboard;
  AppState.userRank = rank;

  renderPolls(polls);
  renderReactions(reactions);
  renderLeaderboard(leaderboard);
  if (rank) renderUserRank(rank);

  // 5. Check which polls user already voted on
  if (AppState.currentUser) {
    for (const poll of polls) {
      const vote = await getUserVote(poll.id, AppState.currentUser.id);
      if (vote !== null) AppState.userVotes[poll.id] = vote.option_index;
    }
    renderPolls(AppState.polls); // re-render with voted state
  }

  // 6. Start all real-time subscriptions
  startRealtimeSubscriptions(match.id);
}

// ─── Real-time subscriptions ───
function startRealtimeSubscriptions(matchId) {
  // Score updates
  const matchChannel = subscribeToMatch(matchId, (updatedMatch) => {
    AppState.match = updatedMatch;
    renderMatch(updatedMatch);
  });

  // New commentary balls
  const commChannel = subscribeToCommentary(matchId, (newBall) => {
    AppState.commentary.unshift(newBall);
    prependCommentaryItem(newBall);
  });

  // Poll vote counts
  const pollChannel = subscribeToMatchPolls(matchId, (updatedPoll) => {
    const idx = AppState.polls.findIndex(p => p.id === updatedPoll.id);
    if (idx !== -1) AppState.polls[idx] = updatedPoll;
    renderSinglePoll(updatedPoll);
  });

  // Reactions
  const reactChannel = subscribeToReactions(matchId, (newReaction) => {
    AppState.reactions[newReaction.emoji] = (AppState.reactions[newReaction.emoji] || 0) + 1;
    updateReactionCount(newReaction.emoji, AppState.reactions[newReaction.emoji]);
  });

  // Leaderboard
  const lbChannel = subscribeToLeaderboard(() => {
    getLeaderboard(50).then(lb => {
      AppState.leaderboard = lb;
      renderLeaderboard(lb);
    });
  });

  // Key moments
  const momentChannel = subscribeToMoments(matchId, (moment) => {
    prependMomentItem(moment);
  });

  // Store channels for cleanup
  AppState.channels = [matchChannel, commChannel, pollChannel, reactChannel, lbChannel, momentChannel];
}

// ─── Render functions (wire to your existing DOM from cricpulse-second-screen.html) ───
function renderMatch(match) {
  const scoreEl = document.getElementById('score-ind');
  if (scoreEl) scoreEl.textContent = match.score1;
  document.querySelector('.score-live').textContent = match.score1;
  // Update overs, win prob meter, current over balls...
}

function renderPolls(polls) {
  polls.forEach(poll => renderSinglePoll(poll));
}

function renderSinglePoll(poll) {
  // Your existing renderPoll() logic from the HTML —
  // pass poll.votes, poll.options, poll.total_votes
  // Check AppState.userVotes[poll.id] for voted state
}

function renderReactions(counts) {
  // Update each reaction button count from the counts object
}

function renderLeaderboard(data) {
  // Your existing renderLeaderboard() logic — pass data array
}

function renderUserRank(rank) {
  document.getElementById('lbMyPoints').textContent = rank.points.toLocaleString();
  document.getElementById('myFantasyPts').textContent = rank.points.toLocaleString();
}

function prependCommentaryItem(ball) {
  // Create a .comm-item div and prepend to #commList
}

function prependMomentItem(moment) {
  // Create a .feed-item div and prepend to #momentFeed
}

function updateReactionCount(emoji, count) {
  // Find the reaction button matching the emoji and update its count span
}

// ─── Start ───
document.addEventListener('DOMContentLoaded', init);
