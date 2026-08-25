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

// Separate from request() because a file upload must NOT set
// Content-Type: application/json — the browser needs to set its own
// multipart/form-data boundary header, which only happens if we leave
// Content-Type unset entirely.
async function uploadFile(path, file, token) {
  const formData = new FormData();
  formData.append('photo', file);

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(data?.message || 'Upload failed.', res.status, data);
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
    delete: (path, body) => request(path, { method: 'DELETE', body, token }),
    upload: (path, file) => uploadFile(path, file, token),
  };
}

export { ApiError, API_BASE };
