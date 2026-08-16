/**
 * roles.js
 *
 * Single source of truth for all valid user roles in the system.
 * Import this wherever role validation is needed — schema enum,
 * controller guards, middleware checks, etc.
 */

const VALID_ROLES = ['Admin', 'Client', 'Contractor', 'Supplier'];

module.exports = { VALID_ROLES };
