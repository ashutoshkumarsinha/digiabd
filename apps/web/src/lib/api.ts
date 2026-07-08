const API_BASE = '';

export function getToken(): string | null {
  // Token is stored by login flow and automatically attached in api().
  return localStorage.getItem('abd_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Small wrapper to keep fetch calls consistent across all views.
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    // API returns RFC7807 Problem Details; `detail` is the most human-friendly field.
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
