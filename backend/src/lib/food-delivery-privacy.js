'use strict';

const { domainError } = require('./food-domain');

const CLOSED_DELIVERY_STATES = new Set(['delivered', 'returned']);

function isRestrictedCourierView(context) {
  return context.roles.includes('courier') && !context.can('delivery.view');
}

function serializeDeliveryForViewer(delivery, context) {
  if (!isRestrictedCourierView(context)) return delivery;
  const closed = CLOSED_DELIVERY_STATES.has(delivery.state);
  const sourceOrder = delivery.order || {};
  const hasPhone = Boolean(sourceOrder.customerPhone || sourceOrder.contact?.phone);
  const order = {
    ...sourceOrder,
    customerPhone: null,
    customerEmail: null,
    contact: sourceOrder.contact ? { ...sourceOrder.contact, phone: null } : null,
  };
  if (closed) {
    order.customerName = null;
    order.deliveryAddress = null;
    order.deliveryNeighborhood = null;
    order.deliveryReference = null;
    order.contact = null;
  }
  return { ...delivery, order, contactAvailable: !closed && hasPhone, customerDataRedacted: closed };
}

function buildDeliveryContactAction(delivery, settings, channel) {
  if (CLOSED_DELIVERY_STATES.has(delivery.state)) throw domainError('Os dados do cliente já não estão disponíveis.', 410, 'FOOD_DELIVERY_CONTACT_EXPIRED');
  if (!['phone', 'whatsapp'].includes(channel)) throw domainError('Canal de contacto inválido.');
  const phone = String(delivery.order?.customerPhone || delivery.order?.contact?.phone || '').trim();
  if (!phone) throw domainError('O cliente não possui telefone disponível.', 404, 'FOOD_DELIVERY_CONTACT_MISSING');
  if (channel === 'phone') return { channel, uri: `tel:${phone}` };
  const digits = phone.replace(/\D/g, '');
  const restaurant = String(settings?.restaurantName || 'KukuGest Food').trim();
  const orderNumber = `#${String(delivery.order.orderNumber).padStart(4, '0')}`;
  const message = `Olá, estou a caminho com o seu pedido ${orderNumber} de ${restaurant}.`;
  return { channel, uri: `https://wa.me/${digits}?text=${encodeURIComponent(message)}` };
}

module.exports = { CLOSED_DELIVERY_STATES, buildDeliveryContactAction, isRestrictedCourierView, serializeDeliveryForViewer };
