'use strict';

const COURIER_BASE_STATUSES = Object.freeze(['available', 'unavailable', 'no_gps']);
const ACTIVE_DELIVERY_STATES = Object.freeze(['assigned', 'approaching_pickup', 'picked_up', 'out_for_delivery', 'arrived']);
const DELIVERY_OPERATIONAL_STATUS = Object.freeze({
  assigned: 'assigned',
  approaching_pickup: 'heading_pickup',
  picked_up: 'at_restaurant',
  out_for_delivery: 'delivering',
  arrived: 'delivering',
});

function deriveCourierOperationalStatus({ profile, shift, activeDelivery }) {
  if (activeDelivery && DELIVERY_OPERATIONAL_STATUS[activeDelivery.state]) {
    return DELIVERY_OPERATIONAL_STATUS[activeDelivery.state];
  }
  if (!shift) return 'off_shift';
  if (!profile?.active) return 'unavailable';
  if (profile.baseStatus === 'available') return 'available';
  if (profile.baseStatus === 'no_gps') return 'no_gps';
  return 'unavailable';
}

module.exports = {
  ACTIVE_DELIVERY_STATES,
  COURIER_BASE_STATUSES,
  deriveCourierOperationalStatus,
};
