const Contractor = require('../models/contractor.schema');
const Client = require('../models/client.schema');
const { userScopeCache, NO_SCOPE, TTL, cacheLog } = require('../utils/authCache');

// ─── In-flight deduplication map ─────────────────────────────────────────────
// If two parallel requests arrive for the same userId before the first DB query
// completes (thundering herd), they both get a MISS. This map ensures the second
// request waits for the first DB promise to resolve instead of firing a duplicate query.
const pendingScope = new Map();

const isScopedRole = (role) => role === 'Contractor' || role === 'Client';

/**
 * Attach contractorId / clientId for portal-scoped roles.
 *
 * Requires ensureUserAuth (or equivalent) to have set an authoritative
 * req.user.role — never trust JWT role alone for scope decisions.
 *
 * Admin / non-scoped roles: pure in-memory fast path (no Mongo), 30-min NO_SCOPE.
 * Positive cache is role-validated so a prior Client/Contractor entry cannot
 * leak onto an Admin after a role change.
 */
const attachUserScope = async (req, res, next) => {
  try {
    if (!req.user) return next();

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (!userId) return next();

    const role = req.user.role;

    // ── Admin / non-scoped fast path (hottest traffic) ──────────────────────
    // Never query Contractor/Client collections. Ignore any stale positive
    // scope left over from a previous role.
    if (!isScopedRole(role)) {
      const cached = userScopeCache.get(userId);
      if (cached?.noScope) {
        cacheLog(`attachUserScope ADMIN HIT — user:${userId} (role:${role}) — no DB`);
        return next();
      }
      userScopeCache.set(userId, NO_SCOPE, { ttl: TTL.SCOPE });
      cacheLog(`attachUserScope ADMIN CACHED — user:${userId} (role:${role}) [30min TTL] — no DB`);
      return next();
    }

    // ── Cache lookup (role-validated) ───────────────────────────────────────
    const cached = userScopeCache.get(userId);

    if (cached) {
      if (cached.noScope) {
        cacheLog(`attachUserScope NEGATIVE HIT — user:${userId} (role:${role}) — skipping scope lookup`);
        return next();
      }

      // Only accept cache entries that match the current role shape.
      if (role === 'Contractor' && cached.contractorId) {
        cacheLog(`attachUserScope HIT  — user:${userId} (role:${role})`);
        req.contractorId = cached.contractorId;
        return next();
      }
      if (role === 'Client' && cached.clientId) {
        cacheLog(`attachUserScope HIT  — user:${userId} (role:${role})`);
        req.clientId = cached.clientId;
        return next();
      }

      // Stale entry from a different role — drop and recompute.
      userScopeCache.delete(userId);
      cacheLog(`attachUserScope STALE — user:${userId} (role:${role}) — cleared mismatched entry`);
    }

    // ── Cache miss — query DB (deduplicated across parallel requests) ────────
    cacheLog(`attachUserScope MISS — user:${userId} (role:${role}) — querying MongoDB`);

    if (pendingScope.has(userId)) {
      cacheLog(`attachUserScope DEDUP — user:${userId} — waiting for in-flight query`);
      await pendingScope.get(userId);
      const resolved = userScopeCache.get(userId);
      if (resolved && !resolved.noScope) {
        if (role === 'Contractor' && resolved.contractorId) {
          req.contractorId = resolved.contractorId;
        } else if (role === 'Client' && resolved.clientId) {
          req.clientId = resolved.clientId;
        }
      }
      return next();
    }

    let resolvePending;
    const scopePromise = new Promise((resolve) => { resolvePending = resolve; });
    pendingScope.set(userId, scopePromise);

    try {
      if (role === 'Contractor') {
        const contractor = await Contractor.findOne({ user: userId, isDeleted: { $ne: true } });
        if (contractor) {
          req.contractorId = contractor._id;
          userScopeCache.set(userId, { contractorId: contractor._id });
        } else {
          userScopeCache.set(userId, NO_SCOPE, { ttl: TTL.SCOPE_NEGATIVE });
          cacheLog(`attachUserScope NEGATIVE CACHED — user:${userId} (no Contractor record)`);
        }
      } else if (role === 'Client') {
        const client = await Client.findOne({ user: userId, isDeleted: { $ne: true } });
        if (client) {
          req.clientId = client._id;
          userScopeCache.set(userId, { clientId: client._id });
        } else {
          userScopeCache.set(userId, NO_SCOPE, { ttl: TTL.SCOPE_NEGATIVE });
          cacheLog(`attachUserScope NEGATIVE CACHED — user:${userId} (no Client record)`);
        }
      }
    } finally {
      resolvePending();
      pendingScope.delete(userId);
    }

    next();
  } catch (error) {
    console.error('Error attaching user scope:', error);
    next(); // Fail open — controller ownership checks will catch missing IDs
  }
};

module.exports = {
  attachUserScope,
};
