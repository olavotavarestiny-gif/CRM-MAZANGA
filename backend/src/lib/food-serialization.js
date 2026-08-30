function exposeOrganizationId(value) {
  if (Array.isArray(value)) return value.map(exposeOrganizationId);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const serialized = {};
  for (const [key, child] of Object.entries(value)) serialized[key] = exposeOrganizationId(child);
  if (Object.prototype.hasOwnProperty.call(value, 'userId') && !Object.prototype.hasOwnProperty.call(value, 'organizationId')) {
    serialized.organizationId = value.userId;
  }
  return serialized;
}

function exposeFoodOrganizationIds(_req, res, next) {
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(exposeOrganizationId(body));
  next();
}

module.exports = { exposeOrganizationId, exposeFoodOrganizationIds };
