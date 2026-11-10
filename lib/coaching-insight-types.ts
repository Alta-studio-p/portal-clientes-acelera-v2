import type { validateInsight } from '@/lib/coaching-insights.mjs';
export type CoachingAnalysis=ReturnType<typeof validateInsight>;
export interface InsightVersion {
  id:string;source_hash:string;model:string;source_call_ids:string[];truncated:boolean;
  analysis:CoachingAnalysis;created_at:string;cost_usd:string|null;
}
export interface TopicReview {topic:string;state:string;note:string;updated_at:string}
export interface RecommendationReview {recommendation_key:string;state:string;note:string;updated_at:string}
export interface CoachingBundle {
  versions:InsightVersion[];topics:TopicReview[];recommendations:RecommendationReview[];
  sourceHash:string;summaryCount:number;totalCalls:number;available:boolean;
}
