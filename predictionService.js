// js/predictionService.js
import { supaClient } from './supabase.js';

// ─── Submit fan predictions ───
// predictions = [{ prediction_type, predicted_value }, ...]
export async function submitPredictions(matchId, userId, predictions) {
  if (!predictions || predictions.length === 0) {
    return { success: false, error: 'No predictions provided.' };
  }

  // Build rows to insert
  const rows = predictions.map(p => ({
    match_id: matchId,
    user_id: userId,
    prediction_type: p.prediction_type,   // e.g. 'next_over_runs', 'final_score'
    predicted_value: p.predicted_value,   // e.g. '11–15', '196–210'
    points_earned: 0                      // resolved later when outcome is known
  }));

  const { data, error } = await supaClient
    .from('predictions')
    .insert(rows)
    .select();

  if (error) {
    console.error('[predictionService] submitPredictions error:', error.message);
    return { success: false, error: error.message };
  }

  // Award base participation points immediately
  await awardPoints(userId, 50, 'prediction_submit');

  return { success: true, predictions: data };
}

// ─── Fetch user's predictions for a match ───
export async function getUserPredictions(matchId, userId) {
  const { data, error } = await supaClient
    .from('predictions')
    .select('*')
    .eq('match_id', matchId)
    .eq('user_id', userId);

  if (error) {
    console.error('[predictionService] getUserPredictions error:', error.message);
    return [];
  }
  return data;
}

// ─── Admin: Resolve predictions and award bonus points ───
export async function adminResolvePrediction(predictionType, correctValue, matchId) {
  // Fetch all matching predictions for this type
  const { data: preds, error } = await supaClient
    .from('predictions')
    .select('id, user_id, predicted_value')
    .eq('match_id', matchId)
    .eq('prediction_type', predictionType)
    .eq('points_earned', 0); // only unresolved

  if (error || !preds) return;

  for (const pred of preds) {
    if (pred.predicted_value === correctValue) {
      // Correct prediction — award 100 bonus points
      await supaClient
        .from('predictions')
        .update({ points_earned: 100 })
        .eq('id', pred.id);

      await awardPoints(pred.user_id, 100, 'prediction_correct');
    } else {
      // Wrong — mark as resolved with 0
      await supaClient
        .from('predictions')
        .update({ points_earned: -1 }) // -1 = resolved, wrong
        .eq('id', pred.id);
    }
  }
}

// ─── Award points to a fan (internal helper) ───
export async function awardPoints(userId, points, reason) {
  // Upsert into fan_points — add to existing total
  const { data: existing } = await supaClient
    .from('fan_points')
    .select('total_points, match_points')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supaClient
      .from('fan_points')
      .update({
        total_points: existing.total_points + points,
        match_points: existing.match_points + points
      })
      .eq('user_id', userId);
  } else {
    // First time this user earns points
    const { data: profile } = await supaClient
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    await supaClient
      .from('fan_points')
      .insert({
        user_id: userId,
        display_name: profile?.full_name || 'Fan',
        total_points: points,
        match_points: points
      });
  }

  console.log(`[predictionService] Awarded ${points} pts to ${userId} for ${reason}`);
}
