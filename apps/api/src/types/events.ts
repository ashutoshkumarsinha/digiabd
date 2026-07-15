export type AbdEventType =
  | "abd.segment.created"
  | "abd.segment.completed"
  | "abd.segment.submitted"
  | "abd.deviation.created"
  | "abd.deviation.approved"
  | "abd.asset.updated";

export * from "./events.js";
export interface SegmentEventPayload {
  segment_id: string;
  route_id: string;
  chainage_start?: number;
  chainage_end?: number;
  completeness?: number;
  status?: string;
}

export interface DeviationEventPayload {
  deviation_id: string;
  segment_id: string;
  category: string;
  severity: string;
  status: string;
}