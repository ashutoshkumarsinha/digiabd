import { useEffect, useState } from 'react';
import { api } from './lib/api';

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

type View = 'login' | 'projects' | 'routes' | 'segments' | 'detail';

export function App() {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('engineer@demo.telecom');
  const [token, setToken] = useState<string | null>(localStorage.getItem('abd_token'));
  const [health, setHealth] = useState('checking...');
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);

  const [projectId, setProjectId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [segmentId, setSegmentId] = useState('');

  const [depth, setDepth] = useState('1.65');
  const [ductType, setDuctType] = useState('HDPE');
  const [notifications, setNotifications] = useState<unknown[]>([]);

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
      await loadNotifications();
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
    setView('detail');
  }

  async function loadNotifications() {
    try {
      setNotifications(await api<unknown[]>('/api/v1/notifications'));
    } catch { /* optional */ }
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
        <p className="subtitle">Phase 2 — Field Capture Portal</p>
        <span className={`badge ${health === 'ok' ? 'ok' : 'warn'}`}>API: {health}</span>
      </header>

      {view !== 'login' && (
        <nav className="nav">
          <button onClick={loadProjects}>Projects</button>
          {projectId && <button onClick={() => loadRoutes(projectId)}>Routes</button>}
          {routeId && <button onClick={() => loadSegments(routeId)}>Segments</button>}
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
          {notifications.length > 0 && (
            <div className="notifications"><h3>Notifications</h3><p>{notifications.length} recent event(s)</p></div>
          )}
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
          <button onClick={submitSegment}>Submit for Review</button>
        </section>
      )}
    </div>
  );
}
