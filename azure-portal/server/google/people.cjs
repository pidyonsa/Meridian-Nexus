'use strict';
// Who a signed-in Microsoft user is in the Firebase-era records: the adminUsers document id (their Firebase uid) for
// their email, so runs, prompts, audit entries and approvals keep one owner across both Nexus sites. People without
// a Firebase account are recorded as "entra:<email>".
const TTL_MS = 10 * 60 * 1000;

function people(fs) {
  const cache = new Map();   // email -> {uid, name, at}
  return async function actorOf(user) {
    const email = String(user?.email || '').toLowerCase().slice(0, 320);
    let hit = cache.get(email);
    if (!hit || Date.now() - hit.at > TTL_MS) {
      const [doc] = email ? await fs.query('adminUsers', {where: [['email', '==', email]], limit: 1}) : [];
      hit = {uid: doc?.id || `entra:${email}`, name: doc?.data?.name ? [doc.data.name, doc.data.surname].filter(Boolean).join(' ') : null, at: Date.now()};
      cache.set(email, hit);
    }
    return {uid: hit.uid, email, name: String(user?.name || hit.name || email).trim().slice(0, 160), role: 'admin'};
  };
}

module.exports = {people};
