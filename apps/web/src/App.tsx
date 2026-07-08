import { useEffect, useState } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
  vendor_name: string | null;
}

export function App() {
  const [email, setEmail] = useState('engineer@demo.telecom');
  const [token, setToken] = useState<string | null>(localStorage.getItem('abd_token'));
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState('checking...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  async function login() {
    setError(null);
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setError('Login failed');
      return;
    }
    const data = await res.json();
    localStorage.setItem('abd_token', data.access_token);
    setToken(data.access_token);
  }

  async function loadProjects() {
    if (!token) return;
    const res = await fetch('/api/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError('Failed to load projects');
      return;
    }
    setProjects(await res.json());
  }

  useEffect(() => {
    if (token) void loadProjects();
  }, [token]);

  return (
    <div className="app">
      <header>
        <h1>Digital ABD</h1>
        <p className="subtitle">As-Built Documentation Portal — Phase 1</p>
        <span className={`badge ${health === 'ok' ? 'ok' : 'warn'}`}>API: {health}</span>
      </header>

      {!token ? (
        <section className="card">
          <h2>Sign In</h2>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button onClick={login}>Login</button>
          {error && <p className="error">{error}</p>}
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row">
              <h2>Projects</h2>
              <button onClick={loadProjects}>Refresh</button>
            </div>
            {projects.length === 0 ? (
              <p>No projects found.</p>
            ) : (
              <ul>
                {projects.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    <span>{p.status}</span>
                    {p.vendor_name && <span className="muted">{p.vendor_name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card muted">
            <p>Phase 1 portal shell — map view, segment capture, and dashboards coming in Phase 2.</p>
          </section>
        </>
      )}
    </div>
  );
}
