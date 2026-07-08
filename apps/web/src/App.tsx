import { useEffect, useState } from 'react';
import { api } from './lib/api';

// Beginner note:
// This component is a single-page "operator console" that demonstrates the core
// backend workflow in one place: login -> projects -> routes -> segments ->
// capture updates -> governance metrics.
interface Project { id: string; name: string; status: string; vendor_name: string | null; }
interface Route { id: string; name: string; total_length_km: string | null; status: string; }
interface Segment { id: string; chainage_start: string; chainage_end: string; completeness: string; status: string; surface_type: string | null; }
interface SegmentDetail extends Segment {
  trench: { depth_m: string; width_m: string | null } | null;
  duct: { duct_type: string; duct_count: number } | null;
  cables: unknown[];
  photos: unknown[];
  deviations: { id: string; category: string; status: string }[];
}
interface Dashboard {
  projects: number;
  segments: { total: number; avg_completeness: string; signed_off: number };
  open_deviations: number;
  faults: { total_faults: number; avg_mttr_minutes: string | null };
  open_escalations: number;
}
interface ProjectSla {
  abd_completeness_rate: number;
  avg_completeness: string;
  total_segments: number;
  signed_off_segments: number;
  open_deviations: number;
  avg_mttr_minutes: string | null;
  sla_status: string;
}
interface ComplianceResult {
  compliance_status: string;
  checks: Array<{ checkpoint: string; status: string; detail: string }>;
}

type View = 'login' | 'projects' | 'routes' | 'segments' | 'detail' | 'governance';

export function App() {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('admin@demo.telecom');
  const [token, setToken] = useState<string | null>(localStorage.getItem('abd_token'));
  const [health, setHealth] = useState('checking...');
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projectSla, setProjectSla] = useState<ProjectSla | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [escalations, setEscalations] = useState<unknown[]>([]);

  const [projectId, setProjectId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [segmentId, setSegmentId] = useState('');

  const [depth, setDepth] = useState('1.65');
  const [ductType, setDuctType] = useState('HDPE');

  useEffect(() => {
    fetch('/health').then((r) => r.json()).then((d) => setHealth(d.status)).catch(() => setHealth('unreachable'));
  }, []);

  async function login() {
    setError(null);
    try {
      const data = await api<{ access_token: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      localStorage.setItem('abd_token', data.access_token);
      setToken(data.access_token);
      setView('projects');
      await loadProjects();
    } catch {
      setError('Login failed');
    }
  }

  async function loadProjects() {
    setProjects(await api<Project[]>('/api/v1/projects'));
    setView('projects');
  }

  async function loadRoutes(id: string) {
    setProjectId(id);
    setRoutes(await api<Route[]>(`/api/v1/projects/${id}/routes`));
    setView('routes');
  }

  async function loadSegments(id: string) {
    setRouteId(id);
    setSegments(await api<Segment[]>(`/api/v1/routes/${id}/segments`));
    setView('segments');
  }

  async function loadDetail(id: string) {
    setSegmentId(id);
    setDetail(await api<SegmentDetail>(`/api/v1/segments/${id}/detail`));
    setCompliance(null);
    setView('detail');
  }

  async function loadGovernance() {
    setDashboard(await api<Dashboard>('/api/v1/governance/dashboard'));
    setEscalations(await api<unknown[]>('/api/v1/governance/escalations?status=open'));
    if (projectId) {
      setProjectSla(await api<ProjectSla>(`/api/v1/governance/projects/${projectId}/sla`));
    }
    setView('governance');
  }

  async function runComplianceCheck() {
    if (!segmentId) return;
    setCompliance(await api<ComplianceResult>(`/api/v1/governance/segments/${segmentId}/compliance`));
  }

  async function evaluateEscalations() {
    await api('/api/v1/governance/escalations/evaluate', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId || undefined }),
    });
    await loadGovernance();
  }

  async function acknowledgeEscalation(eventId: string) {
    await api(`/api/v1/governance/escalations/${eventId}/acknowledge`, { method: 'POST', body: '{}' });
    await loadGovernance();
  }

  async function resolveEscalation(eventId: string) {
    await api(`/api/v1/governance/escalations/${eventId}/resolve`, { method: 'POST', body: '{}' });
    await loadGovernance();
  }

  async function saveTrench() {
    await api(`/api/v1/segments/${segmentId}/trench`, {
      method: 'PUT',
      body: JSON.stringify({ depth_m: Number(depth), width_m: 0.45, bedding_type: 'sand' }),
    });
    await loadDetail(segmentId);
  }

  async function saveDuct() {
    await api(`/api/v1/segments/${segmentId}/duct`, {
      method: 'PUT',
      body: JSON.stringify({ duct_type: ductType, duct_count: 1, diameter_mm: 40 }),
    });
    await loadDetail(segmentId);
  }

  async function submitSegment() {
    try {
      await api(`/api/v1/segments/${segmentId}/submit`, { method: 'POST', body: '{}' });
      await loadDetail(segmentId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Digital ABD</h1>
        <p className="subtitle">Phase 4 — Governance Portal</p>
        <span className={`badge ${health === 'ok' ? 'ok' : 'warn'}`}>API: {health}</span>
      </header>

      {view !== 'login' && (
        <nav className="nav">
          <button onClick={loadProjects}>Projects</button>
          {projectId && <button onClick={() => loadRoutes(projectId)}>Routes</button>}
          {routeId && <button onClick={() => loadSegments(routeId)}>Segments</button>}
          <button onClick={loadGovernance}>Governance</button>
        </nav>
      )}

      {error && <p className="error">{error}</p>}

      {view === 'login' && (
        <section className="card">
          <h2>Sign In</h2>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button onClick={login}>Login</button>
        </section>
      )}

      {view === 'projects' && (
        <section className="card">
          <h2>Projects</h2>
          <ul>{projects.map((p) => (
            <li key={p.id}><button className="link" onClick={() => loadRoutes(p.id)}>{p.name}</button><span>{p.status}</span></li>
          ))}</ul>
        </section>
      )}

      {view === 'routes' && (
        <section className="card">
          <h2>Routes</h2>
          <ul>{routes.map((r) => (
            <li key={r.id}><button className="link" onClick={() => loadSegments(r.id)}>{r.name}</button><span>{r.total_length_km ?? '—'} km</span></li>
          ))}</ul>
        </section>
      )}

      {view === 'segments' && (
        <section className="card">
          <h2>Segments</h2>
          <ul>{segments.map((s) => (
            <li key={s.id}>
              <button className="link" onClick={() => loadDetail(s.id)}>
                Ch {s.chainage_start}–{s.chainage_end}
              </button>
              <span>{s.completeness}%</span><span>{s.status}</span>
            </li>
          ))}</ul>
        </section>
      )}

      {view === 'detail' && detail && (
        <section className="card">
          <h2>Segment Detail</h2>
          <p>Chainage {detail.chainage_start}–{detail.chainage_end} · {detail.completeness}% complete · {detail.status}</p>

          <div className="form-grid">
            <div>
              <h3>Trench</h3>
              <label>Depth (m)<input value={depth} onChange={(e) => setDepth(e.target.value)} /></label>
              <button onClick={saveTrench}>Save Trench</button>
              {detail.trench && <p className="muted">Saved: {detail.trench.depth_m} m deep</p>}
            </div>
            <div>
              <h3>Duct</h3>
              <label>Type<input value={ductType} onChange={(e) => setDuctType(e.target.value)} /></label>
              <button onClick={saveDuct}>Save Duct</button>
              {detail.duct && <p className="muted">Saved: {detail.duct.duct_type} × {detail.duct.duct_count}</p>}
            </div>
          </div>

          <p>Photos: {detail.photos.length} · Cables: {detail.cables.length} · Deviations: {detail.deviations.length}</p>
          <div className="row">
            <button onClick={submitSegment}>Submit for Review</button>
            <button onClick={runComplianceCheck}>Run Compliance Check</button>
          </div>

          {compliance && (
            <div className="compliance">
              <h3>Compliance: {compliance.compliance_status}</h3>
              <ul>{compliance.checks.map((c) => (
                <li key={c.checkpoint} className={`check-${c.status}`}>
                  <strong>{c.checkpoint}</strong> — {c.status}: {c.detail}
                </li>
              ))}</ul>
            </div>
          )}
        </section>
      )}

      {view === 'governance' && dashboard && (
        <>
          <section className="card kpi-grid">
            <div className="kpi"><span className="kpi-value">{dashboard.projects}</span><span className="kpi-label">Projects</span></div>
            <div className="kpi"><span className="kpi-value">{dashboard.segments.total}</span><span className="kpi-label">Segments</span></div>
            <div className="kpi"><span className="kpi-value">{dashboard.segments.avg_completeness}%</span><span className="kpi-label">Avg Completeness</span></div>
            <div className="kpi"><span className="kpi-value">{dashboard.open_deviations}</span><span className="kpi-label">Open Deviations</span></div>
            <div className="kpi"><span className="kpi-value">{dashboard.faults.avg_mttr_minutes ?? '—'}</span><span className="kpi-label">Avg MTTR (min)</span></div>
            <div className="kpi"><span className="kpi-value">{dashboard.open_escalations}</span><span className="kpi-label">Open Escalations</span></div>
          </section>

          {projectSla && (
            <section className="card">
              <h2>Project SLA</h2>
              <p>Status: <strong className={projectSla.sla_status === 'compliant' ? 'ok-text' : 'warn-text'}>{projectSla.sla_status}</strong></p>
              <p>Completeness rate: {projectSla.abd_completeness_rate}% (target 95%)</p>
              <p>Signed off: {projectSla.signed_off_segments} / {projectSla.total_segments} segments</p>
              {projectSla.avg_mttr_minutes && <p>Avg MTTR: {projectSla.avg_mttr_minutes} minutes</p>}
            </section>
          )}

          <section className="card">
            <div className="row">
              <h2>Escalations ({escalations.length} open)</h2>
              <button onClick={evaluateEscalations}>Evaluate Rules</button>
            </div>
            {escalations.length === 0 ? (
              <p className="muted">No open escalations</p>
            ) : (
              <ul>{escalations.map((e: unknown) => {
                const ev = e as { id: string; message: string; severity: string; status: string };
                return (
                  <li key={ev.id} className="row">
                    <span><strong>{ev.severity}</strong> — {ev.message}</span>
                    {ev.status === 'open' && (
                      <button type="button" onClick={() => acknowledgeEscalation(ev.id)}>Acknowledge</button>
                    )}
                    {(ev.status === 'open' || ev.status === 'acknowledged') && (
                      <button type="button" onClick={() => resolveEscalation(ev.id)}>Resolve</button>
                    )}
                  </li>
                );
              })}</ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
