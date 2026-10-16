'use strict';
const {AppError} = require('./errors.cjs');
function previewAllowed(env = process.env) {
  return env.NEXUS_PREVIEW === 'true' && env.NODE_ENV === 'development' && !env.WEBSITE_INSTANCE_ID && !env.WEBSITE_SITE_NAME;
}
function principal(payload, tenant) {
  if (payload.tid !== tenant || !payload.oid || !Array.isArray(payload.roles)) throw new AppError('permission-denied', 'A Meridian staff assignment is required.');
  if (!payload.roles.some(r => ['Nexus.Reader','Nexus.Admin'].includes(r))) throw new AppError('permission-denied', 'You are not assigned to this Nexus application.');
  return {id:payload.oid, name:String(payload.name || 'Meridian staff'), admin:payload.roles.includes('Nexus.Admin'), preview:false};
}
function authentication(env = process.env) {
  let verifier;
  return async (req, res, next) => {
    try {
      if (previewAllowed(env)) { req.user = {id:'preview',name:'Local preview',admin:true,preview:true}; return next(); }
      if (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID) throw new AppError('unavailable', 'Microsoft sign-in has not been configured.');
      const token = req.get('x-ms-token-aad-id-token');
      if (!token) throw new AppError('unauthenticated', 'Sign in with your assigned Meridian account.');
      verifier ||= import('jose').then(({createRemoteJWKSet,jwtVerify}) => ({jwtVerify,keys:createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`))}));
      const {jwtVerify,keys} = await verifier;
      const {payload} = await jwtVerify(token, keys, {algorithms:['RS256'],audience:env.ENTRA_CLIENT_ID,issuer:`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`});
      req.user = principal(payload, env.ENTRA_TENANT_ID);
      next();
    } catch (error) { next(error instanceof AppError ? error : new AppError('unauthenticated', 'Your sign-in has expired. Sign in again.')); }
  };
}
function admin(req,res,next) { next(req.user?.admin ? undefined : new AppError('permission-denied','A Nexus administrator is required.')); }
module.exports = {previewAllowed,principal,authentication,admin};
