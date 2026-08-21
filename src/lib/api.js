const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(data?.message || 'Something went wrong.', res.status);
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
