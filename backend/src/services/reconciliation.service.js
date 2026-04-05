if (!require.extensions['.ts']) {
  require.extensions['.ts'] = require.extensions['.js'];
}

module.exports = require('./reconciliation.service.ts');
