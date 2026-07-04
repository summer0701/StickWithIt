import type { ExerciseRecord } from './exerciseRecords';
import {
  neighborhoodContributionToRow,
  readNeighborhoodProfile,
  type NeighborhoodProfile,
} from './neighborhoodRanking';
import { supabase } from './supabaseClient';
import { isTestUserId } from './testAuth';

export async function syncNeighborhoodContribution({
  userId,
  record,
  profile = readNeighborhoodProfile(userId),
}: {
  userId: string;
  record: ExerciseRecord;
  profile?: NeighborhoodProfile | null;
}) {
  if (!profile || isTestUserId(userId)) return null;
  const row = neighborhoodContributionToRow({ userId, profile, record });
  const { error } = await supabase
    .from('neighborhood_contributions')
    .upsert(row, { onConflict: 'user_id,source_record_id' });

  if (error) {
    console.debug('[neighborhoodContribution] sync failed.', error);
    return null;
  }
  return row;
}
