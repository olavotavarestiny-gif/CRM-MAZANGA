'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeliveryContactAction, serializeDeliveryForViewer } = require('./food-delivery-privacy');

const courierContext = { roles: ['courier'], can: () => false };
const managerContext = { roles: ['delivery_manager'], can: () => true };

function delivery(state = 'assigned') {
  return {
    id: 'delivery-1',
    state,
    order: {
      orderNumber: 12,
      customerName: 'Cliente Teste',
      customerPhone: '+244923000000',
      customerEmail: 'cliente@example.test',
      deliveryAddress: 'Rua 1',
      deliveryNeighborhood: 'Centro',
      deliveryReference: 'Portão preto',
      contact: { id: 1, name: 'Cliente Teste', phone: '+244923000000' },
    },
  };
}

test('entregador recebe contacto por acção auditável, não na listagem', () => {
  const result = serializeDeliveryForViewer(delivery(), courierContext);
  assert.equal(result.contactAvailable, true);
  assert.equal(result.order.customerPhone, null);
  assert.equal(result.order.contact.phone, null);
  const action = buildDeliveryContactAction(delivery(), { restaurantName: 'Materia Preta' }, 'whatsapp');
  assert.match(action.uri, /^https:\/\/wa\.me\/244923000000\?text=/);
  assert.match(decodeURIComponent(action.uri), /pedido #0012 de Materia Preta/);
});

test('dados pessoais são ocultados depois da conclusão e preservados para o gestor', () => {
  const closed = serializeDeliveryForViewer(delivery('delivered'), courierContext);
  assert.equal(closed.customerDataRedacted, true);
  assert.equal(closed.order.customerName, null);
  assert.equal(closed.order.deliveryAddress, null);
  assert.throws(() => buildDeliveryContactAction(delivery('returned'), {}, 'phone'), /já não estão disponíveis/);
  assert.equal(serializeDeliveryForViewer(delivery('delivered'), managerContext).order.customerPhone, '+244923000000');
});
