const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Skips ngrok's free-tier browser-warning interstitial — without this,
      // ngrok returns an HTML warning page (200, no CORS headers) instead of
      // proxying through to the API, which the browser then reports as a
      // CORS failure even though nothing is actually misconfigured.
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(data?.message || 'Something went wrong.', res.status, data);
  }
  return data;
}

// A thin per-request wrapper bound to the current session token — every
// admin page gets one of these from useAuth() rather than juggling tokens itself.
export function createApiClient(token) {
  return {
    get: (path) => request(path, { token }),
    post: (path, body) => request(path, { method: 'POST', body, token }),
    patch: (path, body) => request(path, { method: 'PATCH', body, token }),
    delete: (path) => request(path, { method: 'DELETE', token }),
  };
}

export { ApiError, API_BASE };
