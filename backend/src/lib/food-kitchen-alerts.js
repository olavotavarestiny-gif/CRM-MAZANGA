'use strict';

const DEFAULTS = {
  kdsGreenMinutes: 15,
  kdsYellowMinutes: 25,
  kdsRedMinutes: 35,
  kdsUnacceptedWarningSeconds: 60,
  kdsUnacceptedEscalationSeconds: 120,
  kdsReadyReminderMinutes: 5,
};

function secondsSince(value, now) {
  if (!value) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
}

function deriveKitchenAlert(ticket, settings = {}, now = new Date()) {
  const config = { ...DEFAULTS, ...settings };
  const elapsedSeconds = secondsSince(ticket.createdAt, now);
  const elapsedMinutes = elapsedSeconds / 60;

  if (ticket.state === 'queued' && !ticket.acknowledgedAt) {
    if (elapsedSeconds >= config.kdsUnacceptedEscalationSeconds) {
      return { level: 'cashier_escalation', label: 'Caixa avisado', elapsedSeconds, audible: true, requiresAcknowledgement: true };
    }
    if (elapsedSeconds >= config.kdsUnacceptedWarningSeconds) {
      return { level: 'unaccepted_warning', label: 'Por reconhecer', elapsedSeconds, audible: true, requiresAcknowledgement: true };
    }
    return { level: 'new', label: 'Novo pedido', elapsedSeconds, audible: true, requiresAcknowledgement: true };
  }

  if (ticket.state === 'ready') {
    const readySeconds = secondsSince(ticket.readyAt, now);
    if (readySeconds >= config.kdsReadyReminderMinutes * 60) {
      return { level: 'ready_waiting', label: 'Pronto por recolher', elapsedSeconds, readySeconds, audible: true, requiresAcknowledgement: false };
    }
  }
  if (elapsedMinutes >= config.kdsRedMinutes) return { level: 'critical', label: 'Muito atrasado', elapsedSeconds, audible: true, requiresAcknowledgement: false };
  if (elapsedMinutes >= config.kdsYellowMinutes) return { level: 'late', label: 'Atrasado', elapsedSeconds, audible: true, requiresAcknowledgement: false };
  if (elapsedMinutes >= config.kdsGreenMinutes) return { level: 'near_limit', label: 'Atenção', elapsedSeconds, audible: true, requiresAcknowledgement: false };
  return { level: ticket.acknowledgedAt ? 'acknowledged' : 'on_time', label: ticket.acknowledgedAt ? 'Reconhecido' : 'No tempo', elapsedSeconds, audible: false, requiresAcknowledgement: false };
}

function isCashierEscalation(ticket, settings, now = new Date()) {
  return deriveKitchenAlert(ticket, settings, now).level === 'cashier_escalation';
}

module.exports = { DEFAULT_KITCHEN_ALERTS: DEFAULTS, deriveKitchenAlert, isCashierEscalation };
