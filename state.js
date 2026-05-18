// js/state.js
// Global app state — matches your Aalynex MemDB pattern

export const AppState = {
  currentMatchId: null,
  currentUser: null,     // Supabase auth user object
  currentView: 'live',

  match: null,           // live match data from DB
  commentary: [],        // array of ball objects
  polls: [],             // array of poll objects
  userVotes: {},         // { pollId: optionIndex }
  predictions: {},       // { type: value }
  reactions: {},         // { emoji: count }
  leaderboard: [],
  userRank: null,
  fantasyPlayers: [],

  // Active Supabase realtime channels (store to unsubscribe on cleanup)
  channels: [],
};
