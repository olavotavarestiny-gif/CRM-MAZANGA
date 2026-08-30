const COLLECTION_STATES = Object.freeze([
  'pending_collection',
  'with_courier',
  'handed_to_cashier',
  'reconciled',
  'not_received',
  'discrepancy',
  'returned',
]);

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function collectionDifference(expectedAmount, countedAmount) {
  return money(Number(countedAmount) - Number(expectedAmount));
}

module.exports = { COLLECTION_STATES, collectionDifference, money };
