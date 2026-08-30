const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission, serializeFoodAccess } = require('../../lib/food-access');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

router.get('/', requireFoodPermission('context.view'), async (req, res) => {
  try {
    const branches = req.foodContext.branchIds === null
      ? await prisma.foodBranch.findMany({
        where: { userId: req.foodContext.organizationId, active: true },
        select: { id: true, name: true, isMain: true, address: true, neighborhood: true },
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      })
      : req.foodContext.branches;
    res.json({ ...serializeFoodAccess(req.foodContext), branches });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o contexto Food.');
  }
});

module.exports = router;
