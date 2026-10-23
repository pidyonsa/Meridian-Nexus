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
    // X-Requested-With makes App Service Authentication answer 401 (not a login redirect) when the sign-in expires.
    headers: {Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  // 401 from Nexus, or a bare 401/403 from App Service Authentication (no Nexus error body): the sign-in expired.
  if (res.status === 401 || (res.status === 403 && !data?.error)) {
    location.assign(`/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, {error: {message: 'Signing you in again…'}});
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
