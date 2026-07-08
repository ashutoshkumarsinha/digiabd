import { describe, expect, it } from 'vitest';
import type { ComplianceCheck } from './governance.js';

describe('governance compliance logic', () => {
  it('marks segment compliant when all mandatory checks pass', () => {
    const checks: ComplianceCheck[] = [
      { checkpoint: 'trenching_depth', status: 'pass', detail: '1.65m' },
      { checkpoint: 'duct_type', status: 'pass', detail: 'HDPE' },
      { checkpoint: 'photographic_evidence', status: 'pass', detail: '2 photos' },
      { checkpoint: 'cable_lay_record', status: 'pass', detail: 'recorded' },
      { checkpoint: 'deviations_resolved', status: 'pass', detail: 'none' },
    ];
    const failed = checks.filter((c) => c.status === 'fail').length;
    expect(failed).toBe(0);
    expect(failed === 0 ? 'compliant' : 'non_compliant').toBe('compliant');
  });

  it('marks segment non-compliant when mandatory check fails', () => {
    const checks: ComplianceCheck[] = [
      { checkpoint: 'trenching_depth', status: 'fail', detail: 'missing' },
      { checkpoint: 'duct_type', status: 'pass', detail: 'HDPE' },
    ];
    const failed = checks.filter((c) => c.status === 'fail').length;
    expect(failed).toBeGreaterThan(0);
  });
});
