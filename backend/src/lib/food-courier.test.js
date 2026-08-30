'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveCourierOperationalStatus } = require('./food-courier');

test('estado operacional deriva turno, disponibilidade e tarefa activa', () => {
  assert.equal(deriveCourierOperationalStatus({ profile: null, shift: null, activeDelivery: null }), 'off_shift');
  assert.equal(deriveCourierOperationalStatus({ profile: { active: true, baseStatus: 'available' }, shift: { id: 'shift' }, activeDelivery: null }), 'available');
  assert.equal(deriveCourierOperationalStatus({ profile: { active: true, baseStatus: 'unavailable' }, shift: { id: 'shift' }, activeDelivery: null }), 'unavailable');
  assert.equal(deriveCourierOperationalStatus({ profile: { active: true, baseStatus: 'available' }, shift: { id: 'shift' }, activeDelivery: { state: 'approaching_pickup' } }), 'heading_pickup');
  assert.equal(deriveCourierOperationalStatus({ profile: { active: true, baseStatus: 'available' }, shift: { id: 'shift' }, activeDelivery: { state: 'out_for_delivery' } }), 'delivering');
});
