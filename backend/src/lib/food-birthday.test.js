const test = require('node:test');
const assert = require('node:assert/strict');
const { nextBirthday } = require('../services/food-birthday.service');
const { normalizeFoodCustomerPreferences } = require('../services/food-customer.service');

test('aniversário calcula mudança de ano e 29 de fevereiro sem deslocamento', () => {
  const yearEnd = nextBirthday('1990-01-01T00:00:00.000Z', '2026-12-30T18:00:00.000Z');
  assert.equal(yearEnd.date.toISOString().slice(0, 10), '2027-01-01');
  assert.equal(yearEnd.daysUntil, 2);
  assert.equal(yearEnd.ageTurning, 37);

  const leapDay = nextBirthday('1992-02-29T00:00:00.000Z', '2026-02-27T12:00:00.000Z');
  assert.equal(leapDay.date.toISOString().slice(0, 10), '2026-02-28');
  assert.equal(leapDay.daysUntil, 1);
});

test('preferências Food normalizam listas, canal e tipo de pedido', () => {
  const preferences = normalizeFoodCustomerPreferences({
    allergies: ['Marisco', 'Marisco', ' Amendoim '],
    dietaryRestrictions: 'Sem glúten;Vegetariano',
    preferredChannel: 'email',
    preferredOrderType: 'pickup',
    favoriteNotes: ' Molho à parte ',
  }, { customPreference: true });
  assert.deepEqual(preferences.allergies, ['Marisco', 'Amendoim']);
  assert.deepEqual(preferences.dietaryRestrictions, ['Sem glúten', 'Vegetariano']);
  assert.equal(preferences.preferredChannel, 'EMAIL');
  assert.equal(preferences.preferredOrderType, 'pickup');
  assert.equal(preferences.favoriteNotes, 'Molho à parte');
  assert.equal(preferences.customPreference, true);
});
