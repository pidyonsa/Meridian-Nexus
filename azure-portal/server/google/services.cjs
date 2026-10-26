'use strict';
// The admin tools that still work on Firebase-era data (Report automation, Resources, ETLs, extraction profiles, Geo
// attendance, SharePoint inventory), wired to one keyless Google token. All null when the site has no GOOGLE_*
// settings; their APIs then answer 503. SharePoint (Graph) and Key Vault need the site's managed identity.
const {googleConfigured, tokenSource} = require('./token.cjs');
const {firestore} = require('./firestore.cjs');
const {storage} = require('./storage.cjs');
const {people} = require('./people.cjs');

const NONE = {automation: null, resources: null, etls: null, profiles: null, geo: null, exclusions: null, inventory: null};

function googleServices(env = process.env) {
  if (!googleConfigured(env)) return {...NONE};
  const token = tokenSource(env);
  const fs = firestore({token}), files = storage({token}), actorOf = people(fs);
  const vault = require('../azure/keyvault.cjs').keyVault({env});
  const graph = require('../azure/graph.cjs').graphClient({vault});
  return {
    automation: require('../automation/service.cjs').automationService({fs, storage: files}),
    resources: require('../resources/service.cjs').resourceService({fs, storage: files}),
    etls: require('../etl/service.cjs').etlService({fs, storage: files, invokeJob: require('../etl/launcher.cjs').etlLauncher({env})}),
    profiles: require('../profiles/service.cjs').profileService({fs, credentialKey: require('../profiles/credentials.cjs').keySource({env})}),
    geo: require('../attendance/geo.cjs').geoAttendanceService({fs, storage: files, graph, actorOf}),
    exclusions: require('../attendance/exclusions.cjs').exclusionService({fs, actorOf}),
    inventory: require('../attendance/inventory.cjs').inventoryService({fs, graph, actorOf})
  };
}

module.exports = {googleServices};
