export type UserRole =
  | 'field_engineer'
  | 'site_supervisor'
  | 'inspector_oic'
  | 'gis_engineer'
  | 'noc_operator'
  | 'program_manager'
  | 'auditor'
  | 'vendor_admin'
  | 'enterprise_admin'
  | 'system_admin';

export interface AuthUser {
  sub: string;
  orgId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  tier: string;
  data_region: string;
  retention_years: number;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  business_unit_id: string | null;
  name: string;
  client_name: string | null;
  vendor_name: string | null;
  project_type: string;
  status: string;
  design_route_ref: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  total_length_km: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: string;
  org_id: string;
  route_id: string;
  chainage_start: string;
  chainage_end: string;
  surface_type: string | null;
  status: string;
  completeness: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deviation {
  id: string;
  org_id: string;
  segment_id: string;
  category: string;
  description: string;
  justification: string | null;
  severity: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NocLookupResult {
  segment: Segment | null;
  route: Route | null;
  project: Project | null;
  closures: Array<{ id: string; closure_type: string; distance_m: number | null }>;
  deviations: Deviation[];
}
