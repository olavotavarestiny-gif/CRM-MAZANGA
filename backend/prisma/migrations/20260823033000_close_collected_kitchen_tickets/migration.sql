UPDATE "food_kitchen_tickets" AS ticket
SET "state" = 'collected', "updatedAt" = CURRENT_TIMESTAMP
FROM "food_orders" AS food_order
LEFT JOIN "food_deliveries" AS delivery ON delivery."orderId" = food_order."id"
WHERE ticket."orderId" = food_order."id"
  AND ticket."state" = 'ready'
  AND (
    food_order."orderState" IN ('completed', 'cancelled')
    OR delivery."state" IN ('picked_up', 'out_for_delivery', 'arrived', 'delivered', 'failed', 'returned')
  );
