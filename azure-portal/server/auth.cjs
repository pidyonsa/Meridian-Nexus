'use strict';
const {AppError} = require('./errors.cjs');

const MERIDIAN_TENANT = 'cbe83df2-b350-4dab-8d5f-f78d21fe7d27';
const TENANT_CLAIMS = new Set(['http://schemas.microsoft.com/identity/claims/tenantid', 'tid']);
const OBJECT_CLAIMS = new Set(['http://schemas.microsoft.com/identity/claims/objectidentifier', 'oid']);
const EMAIL_CLAIMS = new Set(['preferred_username', 'email', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn']);
const ROLE_CLAIMS = new Set(['roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']);
// Guests invited into the Meridian tenant carry an identity-provider claim naming their home provider; staff do not.
const IDP_CLAIMS = new Set(['idp', 'http://schemas.microsoft.com/identity/claims/identityprovider']);
// Entra app roles on the "Meridian Nexus Azure" registration. Admin implies everything a Reader may do.
const ROLES = {admin: 'Nexus.Admin', reader: 'Nexus.Reader'};

// Local development only: never on App Service (WEBSITE_* is always set there).
function previewAllowed(env = process.env) {
  return env.NEXUS_PREVIEW === 'true' && env.NODE_ENV === 'development' && !env.WEBSITE_INSTANCE_ID && !env.WEBSITE_SITE_NAME;
}

// App Service Authentication (Entra ID) signs the user in and passes them in X-MS-CLIENT-PRINCIPAL. The platform
// strips that header from incoming requests, so a caller cannot supply it.
function principalFromHeader(header, tenant = MERIDIAN_TENANT) {
  if (!header || header.length > 16384) return null;
  try {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    const claims = Array.isArray(principal?.claims) ? principal.claims : [];
    const value = types => claims.find(claim => types.has(claim.typ))?.val;
    if (principal.auth_typ !== 'aad' || value(TENANT_CLAIMS) !== tenant) return null;
    const idp = value(IDP_CLAIMS);
    if (idp && !String(idp).includes(tenant)) return null;
    const id = value(OBJECT_CLAIMS);
    if (!id) return null;
    const roles = new Set(claims.filter(claim => ROLE_CLAIMS.has(claim.typ) || claim.typ === principal.role_typ).map(claim => claim.val));
    return {id, email: String(value(EMAIL_CLAIMS) || '').toLowerCase(), name: String(claims.find(claim => claim.typ === 'name')?.val || value(EMAIL_CLAIMS) || 'Meridian staff'), admin: roles.has(ROLES.admin), reader: roles.has(ROLES.admin) || roles.has(ROLES.reader), preview: false};
  } catch {
    return null;
  }
}

function authentication(env = process.env) {
  return (req, res, next) => {
    if (previewAllowed(env)) {
      req.user = {id: '00000000-0000-0000-0000-000000000001', email: 'preview@meridiangroup.co.za', name: 'Local preview', admin: true, reader: true, preview: true};
      return next();
    }
    req.user = principalFromHeader(req.get('x-ms-client-principal'));
    next();
  };
}

// Pages: send signed-out visitors to Microsoft sign-in. APIs: answer 401 so the browser can do the same.
// NEXUS_ADMIN_ONLY=true limits the whole site to Nexus admins while sections are still being moved over.
function requireUser(env = process.env) {
  return (req, res, next) => {
    if (req.user?.admin || (req.user?.reader && env.NEXUS_ADMIN_ONLY !== 'true')) return next();
    if (req.user?.reader) return next(new AppError('permission-denied', 'The new Nexus is open to administrators only for now. Keep using the current Nexus.'));
    if (req.user) return next(new AppError('permission-denied', 'Your Meridian account is not assigned to Nexus. Ask the Nexus administrator for access.'));
    if (req.path.startsWith('/api/')) return next(new AppError('unauthenticated', 'Sign in with your Meridian account.'));
    res.redirect(302, `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(req.originalUrl || '/')}`);
  };
}

function requireAdmin(req, res, next) {
  next(req.user?.admin ? undefined : new AppError('permission-denied', 'A Nexus administrator is required.'));
}

module.exports = {ROLES, MERIDIAN_TENANT, previewAllowed, principalFromHeader, authentication, requireUser, requireAdmin};
