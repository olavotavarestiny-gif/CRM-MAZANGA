const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodModule } = require('../../lib/food-access');
const { exposeFoodOrganizationIds } = require('../../lib/food-serialization');
const contextRouter = require('./context');
const foundationRouter = require('./foundation');
const catalogRouter = require('./catalog');
const overviewRouter = require('./overview');
const teamRouter = require('./team');
const orderRouter = require('./orders');
const deliveryRouter = require('./delivery');
const paymentRouter = require('./payments');
const stockRouter = require('./stock');
const customerRouter = require('./customers');
const managementRouter = require('./management');
const marketingRouter = require('./marketing');

const router = express.Router();

router.use(exposeFoodOrganizationIds);
router.use(requireFoodModule(prisma, { allowDisabled: true }));
router.use('/context', contextRouter);
router.use('/', foundationRouter);
router.use((req, res, next) => {
  if (req.foodContext.enabled) return next();
  return res.status(403).json({
    error: 'O módulo KukuGest Food está desactivado para esta organização.',
    code: 'FOOD_NOT_ENABLED',
  });
});
router.use('/team', teamRouter);
router.use('/delivery', deliveryRouter);
router.use('/stock', stockRouter);
router.use('/customers', customerRouter);
router.use('/management', managementRouter);
router.use('/marketing', marketingRouter);
router.use('/', catalogRouter);
router.use('/', overviewRouter);
router.use('/', paymentRouter);
router.use('/', orderRouter);

module.exports = router;
