const crypto = require('crypto');

const API_KEY_PREFIX = 'kg_live_';
const DEFAULT_SCOPES = ['contacts:write', 'sales:write'];

function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(String(apiKey || ''), 'utf8').digest('hex');
}

function getKeyPrefix(apiKey) {
  return String(apiKey || '').slice(0, API_KEY_PREFIX.length + 8);
}

function extractApiKey(req) {
  const xApiKey = req.get?.('x-api-key');
  if (xApiKey) return xApiKey.trim();
  const authorization = req.get?.('authorization') || req.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return '';
}

function parseScopes(value) {
  if (Array.isArray(value)) return value.filter((scope) => typeof scope === 'string');
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((scope) => typeof scope === 'string') : [];
  } catch {
    return [];
  }
}

module.exports = { API_KEY_PREFIX, DEFAULT_SCOPES, extractApiKey, generateApiKey, getKeyPrefix, hashApiKey, parseScopes };
