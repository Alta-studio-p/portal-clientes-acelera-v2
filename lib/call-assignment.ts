import type { Call } from '@/lib/supabase/types';

export type AttentionCall = Pick<Call, 'id' | 'client_id' | 'coach_id' | 'title' | 'display_title' | 'started_at' | 'summary' | 'recording_url' | 'share_url'> & { coach_name: string | null };
export interface AssignmentClient { id: string; name: string; email: string | null }
export interface AssignmentState { error: string | null; success: boolean }
