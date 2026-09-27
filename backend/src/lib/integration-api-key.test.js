const test = require('node:test');
const assert = require('node:assert/strict');
const { API_KEY_PREFIX, extractApiKey, generateApiKey, getKeyPrefix, hashApiKey, parseScopes } = require('./integration-api-key');

test('generates opaque API keys and stores a stable hash', () => {
  const first = generateApiKey();
  const second = generateApiKey();
  assert.ok(first.startsWith(API_KEY_PREFIX));
  assert.notEqual(first, second);
  assert.equal(hashApiKey(first), hashApiKey(first));
  assert.notEqual(hashApiKey(first), hashApiKey(second));
  assert.equal(getKeyPrefix(first), first.slice(0, API_KEY_PREFIX.length + 8));
});

test('extracts x-api-key before bearer authorization', () => {
  const req = { get(name) { return { 'x-api-key': ' key-one ', authorization: 'Bearer key-two' }[name]; } };
  assert.equal(extractApiKey(req), 'key-one');
});

test('parses scopes defensively', () => {
  assert.deepEqual(parseScopes('["contacts:write","sales:write"]'), ['contacts:write', 'sales:write']);
  assert.deepEqual(parseScopes('invalid'), []);
  assert.deepEqual(parseScopes({}), []);
});
