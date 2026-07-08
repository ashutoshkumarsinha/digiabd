import type { AbdEventType } from './events.js';

export type { AbdEventType };

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
