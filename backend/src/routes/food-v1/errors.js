function handleFoodV1Error(res, error, fallback = 'Erro no KukuGest Food.') {
  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'Já existe um registo com estes dados.', code: 'FOOD_DUPLICATE' });
  }
  if (error?.statusCode || error?.status) {
    return res.status(error.statusCode || error.status).json({
      error: error.message,
      code: error.code || 'FOOD_REQUEST_ERROR',
    });
  }
  console.error('[food-v1]', error);
  return res.status(500).json({ error: fallback, code: 'FOOD_INTERNAL_ERROR' });
}

module.exports = { handleFoodV1Error };
