'use strict';
// The admin tools that still work on Firebase-era data (Report automation, Resources, ETLs), wired to one keyless
// Google token. All null when the site has no GOOGLE_* settings; their APIs then answer 503.
const {googleConfigured, tokenSource} = require('./token.cjs');
const {firestore} = require('./firestore.cjs');
const {storage} = require('./storage.cjs');

function googleServices(env = process.env) {
  if (!googleConfigured(env)) return {automation: null, resources: null, etls: null};
  const token = tokenSource(env);
  const fs = firestore({token}), files = storage({token});
  return {
    automation: require('../automation/service.cjs').automationService({fs, storage: files}),
    resources: require('../resources/service.cjs').resourceService({fs, storage: files}),
    etls: require('../etl/service.cjs').etlService({fs, storage: files, invokeJob: require('../etl/launcher.cjs').etlLauncher({env})})
  };
}

module.exports = {googleServices};
