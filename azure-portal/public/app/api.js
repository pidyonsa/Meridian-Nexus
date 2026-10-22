// Calls to the Nexus API. Easy Auth cookies need same-origin credentials; a 401 means the sign-in expired.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Nexus could not complete the request (${status}).`);
    this.status = status;
    this.code = body?.error?.code || 'internal';
    this.requestId = body?.error?.requestId;
  }
}

export async function api(path, {method = 'GET', body, signal} = {}) {
  const res = await fetch(`/api${path}`, {
    method, signal, credentials: 'same-origin',
    headers: body === undefined ? {Accept: 'application/json'} : {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 401) {
    location.assign(`/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, {error: {message: 'Signing you in again…'}});
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
