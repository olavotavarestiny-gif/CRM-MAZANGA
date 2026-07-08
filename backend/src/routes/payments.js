const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const ekwanza = require('../services/ekwanza-payment.service');
const subscriptionBilling = require('../services/subscription-billing.service');
const { getPricingCatalog, CYCLES } = require('../lib/subscription-pricing');
const { getPlanContext } = require('../lib/plan-limits');
const { SUPPORTED_PLANS } = require('../lib/plans');

/**
 * POST /api/payments/charge
 * Cria uma cobrança E+ Kwanza (GPO = Multicaixa Express, REF = Referência EMIS).
 * Protegido por requireAuth (o /callback abaixo é público para o gateway).
 */
router.post('/charge', requireAuth, async (req, res) => {
  try {
    const { amount, method, description, phoneNumber } = req.body || {};

    const result = await ekwanza.createCharge({
      amount,
      method,
      description,
      phoneNumber,
    });

    if (!result.successful) {
      return res.status(402).json({
        ok: false,
        message: result.message || 'Pagamento não concluído',
        gatewayCode: result.gatewayCode,
        merchantTransactionId: result.merchantTransactionId,
      });
    }

    return res.json({
      ok: true,
      merchantTransactionId: result.merchantTransactionId,
      providerTransactionId: result.providerTransactionId,
      reference: result.reference,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof ekwanza.EkwanzaPaymentError) {
      return res.status(error.status).json({
        ok: false,
        code: error.code,
        message: error.message,
        gatewayCode: error.gatewayCode,
      });
    }
    console.error('[payments] erro inesperado:', error);
    return res.status(500).json({ ok: false, message: 'Erro interno' });
  }
});

/**
 * GET /api/payments/subscription/pricing
 * Catálogo de preços do workspace da conta (frontend lê daqui).
 */
router.get('/subscription/pricing', requireAuth, async (req, res) => {
  try {
    const { workspaceMode } = await getPlanContext(req.user.effectiveUserId);
    return res.json(getPricingCatalog(workspaceMode));
  } catch (error) {
    console.error('[payments] erro ao obter pricing:', error);
    return res.status(500).json({ ok: false, message: 'Erro ao obter preços' });
  }
});

/**
 * POST /api/payments/subscription/charge
 * Cobra a subscrição da própria conta. Só o dono da conta pode pagar.
 * Body: { plan, cycle, method, phoneNumber? }
 */
router.post('/subscription/charge', requireAuth, async (req, res) => {
  try {
    const { plan, cycle, method, phoneNumber } = req.body || {};

    if (!SUPPORTED_PLANS.includes(plan)) {
      return res.status(400).json({ ok: false, message: 'Plano inválido' });
    }
    if (!CYCLES.includes(cycle)) {
      return res.status(400).json({ ok: false, message: 'Ciclo inválido (monthly|annual)' });
    }
    // Por agora aceitamos apenas Multicaixa Express (GPO). Para reativar a
    // Referência (REF), permitir 'REF' aqui e repor o fluxo no frontend.
    if (method !== 'GPO') {
      return res.status(400).json({ ok: false, message: 'Apenas Multicaixa Express disponível de momento' });
    }

    const { workspaceMode } = await getPlanContext(req.user.effectiveUserId);

    const result = await subscriptionBilling.createSubscriptionCharge({
      ownerUserId: req.user.effectiveUserId,
      workspaceMode,
      plan,
      cycle,
      method,
      phoneNumber,
    });

    // GPO: sucesso/insucesso imediato. REF: pendente (paga depois).
    if (result.status === 'failed') {
      return res.status(402).json({ ok: false, ...result });
    }
    return res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ekwanza.EkwanzaPaymentError) {
      return res.status(error.status).json({
        ok: false,
        code: error.code,
        message: error.message,
        gatewayCode: error.gatewayCode,
      });
    }
    console.error('[payments] erro na cobrança de subscrição:', error);
    return res.status(500).json({ ok: false, message: 'Erro interno' });
  }
});

/**
 * GET /api/payments/subscription/status/:merchantTransactionId
 * Polling do estado do pagamento (sobretudo para Referência).
 */
router.get('/subscription/status/:merchantTransactionId', requireAuth, async (req, res) => {
  try {
    const payment = await subscriptionBilling.getPaymentStatus(
      req.user.effectiveUserId,
      req.params.merchantTransactionId
    );
    if (!payment) {
      return res.status(404).json({ ok: false, message: 'Pagamento não encontrado' });
    }
    return res.json({ ok: true, ...payment });
  } catch (error) {
    console.error('[payments] erro ao obter estado:', error);
    return res.status(500).json({ ok: false, message: 'Erro interno' });
  }
});

/**
 * POST /api/payments/callback
 * Webhook público chamado pela E+ Kwanza ao confirmar um pagamento.
 * Montado SEM requireAuth (ver index.js). A autenticidade é validada
 * pela assinatura HMAC (x-signature) para o fluxo nativo /Ticket.
 *
 * Estruturas possíveis:
 *  - Nativo e-kwanza:  { code, operationCode, status, amount } + header x-signature
 *  - AppyPay GPO/REF:  { merchantTransactionId, ekwanzaTransactionId, operationStatus, operationData }
 */
router.post('/callback', async (req, res) => {
  // Responder cedo para evitar reenvios do gateway.
  res.status(200).json({ status: '0' });

  try {
    const body = req.body || {};

    // Fluxo nativo e-kwanza (/Ticket) — validar assinatura
    if (body.code && body.operationCode) {
      const valid = ekwanza.verifyCallbackSignature({
        code: body.code,
        operationCode: body.operationCode,
        signature: req.headers['x-signature'],
      });
      if (!valid) {
        console.warn('[payments] callback /Ticket com assinatura inválida — ignorado');
        return;
      }
      console.log('[payments] pagamento confirmado (Ticket):', body.code, 'status', body.status);
      // TODO: atualizar estado do pagamento/factura na base de dados
      return;
    }

    // Fluxo AppyPay GPO/REF
    if (body.merchantTransactionId) {
      console.log(
        '[payments] callback AppyPay:',
        body.merchantTransactionId,
        'operationStatus',
        body.operationStatus
      );
      // operationStatus: 1=pago, 3=cancelado/expirado, 4=falhado, 5=erro
      await subscriptionBilling.handleCallbackConfirmation({
        merchantTransactionId: body.merchantTransactionId,
        operationStatus: body.operationStatus,
      });
      return;
    }

    console.warn('[payments] callback com estrutura desconhecida:', JSON.stringify(body));
  } catch (error) {
    console.error('[payments] erro ao processar callback:', error.message);
  }
});

module.exports = router;
