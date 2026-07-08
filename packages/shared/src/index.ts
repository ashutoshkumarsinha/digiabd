export type SegmentStatus = 'draft' | 'in_progress' | 'submitted' | 'approved' | 'signed_off';
export type DuctType = 'HDPE' | 'DWC' | 'RCC';
export type PhotoPhase = 'before' | 'during' | 'after';

export interface Project {
  id: string;
  name: string;
  status: string;
  vendor_name: string | null;
  client_name: string | null;
}

export interface Route {
  id: string;
  project_id: string;
  name: string;
  total_length_km: string | null;
  status: string;
}

export interface Segment {
  id: string;
  route_id: string;
  chainage_start: string;
  chainage_end: string;
  surface_type: string | null;
  status: SegmentStatus;
  completeness: string;
}

export interface SegmentDetail extends Segment {
  trench: TrenchRecord | null;
  duct: DuctRecord | null;
  cables: CableLayRecord[];
  photos: PhotoEvidence[];
  deviations: Deviation[];
}

export interface TrenchRecord {
  depth_m: string;
  width_m: string | null;
  bedding_type: string | null;
  reinstatement_status: string;
}

export interface DuctRecord {
  duct_type: DuctType;
  diameter_mm: string | null;
  duct_count: number;
  protection_method: string | null;
}

export interface CableLayRecord {
  id: string;
  core_count: number;
  sheath_type: string | null;
  drum_number: string | null;
  laid_length_m: string;
}

export interface PhotoEvidence {
  id: string;
  phase: PhotoPhase;
  file_ref: string;
  captured_at: string;
}

export interface Deviation {
  id: string;
  category: string;
  description: string;
  status: string;
  severity: string;
}

export type AbdEventType =
  | 'abd.segment.created'
  | 'abd.segment.completed'
  | 'abd.segment.submitted'
  | 'abd.deviation.created'
  | 'abd.deviation.approved'
  | 'abd.asset.updated';

export interface SyncBatchItem {
  client_id: string;
  operation: 'create_segment' | 'upsert_trench' | 'upsert_duct' | 'upsert_cable' | 'create_deviation';
  payload: Record<string, unknown>;
}

export interface SyncBatchRequest {
  device_id?: string;
  items: SyncBatchItem[];
}

export interface SyncBatchResult {
  batch_id: string;
  status: string;
  success_count: number;
  error_count: number;
  results: Array<{ client_id: string; status: 'ok' | 'error'; entity_id?: string; error?: string }>;
}
