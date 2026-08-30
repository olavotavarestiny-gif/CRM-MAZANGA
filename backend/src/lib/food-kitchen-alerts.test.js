'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveKitchenAlert, isCashierEscalation } = require('./food-kitchen-alerts');

const now = new Date('2026-08-23T12:00:00.000Z');
const settings = {
  kdsGreenMinutes: 15,
  kdsYellowMinutes: 25,
  kdsRedMinutes: 35,
  kdsUnacceptedWarningSeconds: 60,
  kdsUnacceptedEscalationSeconds: 120,
  kdsReadyReminderMinutes: 5,
};

function ticket(secondsAgo, data = {}) {
  return { state: 'queued', createdAt: new Date(now.getTime() - secondsAgo * 1000), acknowledgedAt: null, ...data };
}

test('classifica ticket novo, aviso e escalamento ao Caixa', () => {
  assert.equal(deriveKitchenAlert(ticket(30), settings, now).level, 'new');
  assert.equal(deriveKitchenAlert(ticket(60), settings, now).level, 'unaccepted_warning');
  assert.equal(deriveKitchenAlert(ticket(120), settings, now).level, 'cashier_escalation');
  assert.equal(isCashierEscalation(ticket(120), settings, now), true);
});

test('reconhecimento silencia o alerta novo sem esconder o atraso', () => {
  const acknowledged = ticket(61, { acknowledgedAt: new Date(now.getTime() - 1000) });
  assert.deepEqual(deriveKitchenAlert(acknowledged, settings, now), {
    level: 'acknowledged', label: 'Reconhecido', elapsedSeconds: 61, audible: false, requiresAcknowledgement: false,
  });
  assert.equal(deriveKitchenAlert(ticket(26 * 60, { state: 'preparing', acknowledgedAt: now }), settings, now).level, 'late');
});

test('avisa quando um pedido pronto não é recolhido', () => {
  const ready = ticket(20 * 60, { state: 'ready', acknowledgedAt: now, readyAt: new Date(now.getTime() - 5 * 60 * 1000) });
  assert.equal(deriveKitchenAlert(ready, settings, now).level, 'ready_waiting');
});
