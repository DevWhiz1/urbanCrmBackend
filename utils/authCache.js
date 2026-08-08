/**
 * authCache.js
 *
 * Shared in-process LRU caches for authentication and scope middleware.
 * All middleware and controllers import from this single module to operate
 * on the exact same cache object in memory — this is critical for
 * invalidation to actually work.
 *
 * ┌─────────────────┬──────────────────────────────────┬──────────┐
 * │ Cache           │ Stores                           │ TTL      │
 * ├─────────────────┼──────────────────────────────────┼──────────┤
 * │ userAuthCache   │ { role, status } per userId      │ 5 min    │
 * │                 │ Admin entries                    │ 15 min   │
 * │ userScopeCache  │ { contractorId } or { clientId } │ 30 min   │
 * │                 │ or NO_SCOPE sentinel             │ 2 min    │
 * │                 │ Admin / non-scoped NO_SCOPE      │ 30 min   │
 * └─────────────────┴──────────────────────────────────┴──────────┘
 *
 * Invalidation rules:
 *  - user.role changed               → invalidateUser(userId)  (auth + scope)
 *  - user.status changed             → invalidateUserAuth(userId)
 *  - Contractor/Client created/updated → invalidateUserScope(userId)
 *  - Contractor/Client user ref changed→ invalidateUserScope(old) + invalidateUserScope(new)
 *  - Contractor/Client deleted         → invalidateUser(userId)
 *  - user deleted                      → invalidateUser(userId)
 *  - user logout                       → invalidateUser(userId)
 */

const { LRUCache } = require('lru-cache');

// ─── Centralised TTL configuration ───────────────────────────────────────────
const TTL = {
  AUTH:           5 * 60 * 1000,  // 5 min  — role + status (short: admin changes propagate quickly)
  AUTH_ADMIN:    15 * 60 * 1000,  // 15 min — Admin is hottest path; own role rarely changes
  SCOPE:         30 * 60 * 1000,  // 30 min — contractorId / clientId (stable IDs)
  SCOPE_NEGATIVE: 2 * 60 * 1000, // 2 min  — "no record found" sentinel (avoids repeated DB hits for unlinked users)
};

const MAX_ENTRIES = 500; // max simultaneous cached users

// ─── Sentinel for negative scope caching ──────────────────────────────────────
// Stored when a Contractor/Client lookup returns null so we don't hammer DB
// for every request from an Admin or a user whose profile isn't linked yet.
const NO_SCOPE = Object.freeze({ noScope: true });

// ─── Dev-only logging ─────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
const cacheLog = (msg) => {
  if (isDev) console.log(`  \x1b[36m[Cache]\x1b[0m ${msg}`);
};

// ─── Cache instances ──────────────────────────────────────────────────────────
const userAuthCache  = new LRUCache({ max: MAX_ENTRIES, ttl: TTL.AUTH });
const userScopeCache = new LRUCache({ max: MAX_ENTRIES, ttl: TTL.SCOPE });

// ─── Invalidation helpers ─────────────────────────────────────────────────────

/**
 * Bust the auth cache for a user.
 * Call whenever status is modified in DB (role changes should use invalidateUser).
 */
const invalidateUserAuth = (userId) => {
  if (!userId) return;
  const key = userId.toString();
  const wasCached = userAuthCache.has(key);
  userAuthCache.delete(key);
  cacheLog(`invalidateUserAuth(${key}) — was cached: ${wasCached}`);
};

/**
 * Bust the scope cache for a user.
 * Call whenever a Contractor or Client record linked to this userId is created, updated, or deleted.
 */
const invalidateUserScope = (userId) => {
  if (!userId) return;
  const key = userId.toString();
  const wasCached = userScopeCache.has(key);
  userScopeCache.delete(key);
  cacheLog(`invalidateUserScope(${key}) — was cached: ${wasCached}`);
};

/**
 * Bust both caches for a user.
 * Call on role change, logout, or full user deletion.
 */
const invalidateUser = (userId) => {
  invalidateUserAuth(userId);
  invalidateUserScope(userId);
};

module.exports = {
  userAuthCache,
  userScopeCache,
  TTL,
  NO_SCOPE,
  cacheLog,
  invalidateUserAuth,
  invalidateUserScope,
  invalidateUser,
};
