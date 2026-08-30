const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission } = require('../../lib/food-access');
const { domainError } = require('../../lib/food-domain');
const { handleFoodV1Error } = require('./errors');
const { recordFoodAudit } = require('../../lib/food-audit');
const { listFoodBirthdays } = require('../../services/food-birthday.service');

const router = express.Router();

function valueText(value, max = 500) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

const defaultBirthdaySettings = {
  enabled: false,
  daysBefore: 0,
  sendTime: '09:00',
  channel: 'WHATSAPP',
  template: 'Feliz aniversário, {{nome}}!',
  benefitType: 'none',
  couponId: null,
  validityDays: 7,
  minimumOrder: 0,
  segmentId: null,
};

router.get('/birthdays', requireFoodPermission('crm.view'), async (req, res) => {
  try {
    res.json(await listFoodBirthdays(prisma, req.foodContext.organizationId, req.query.days));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os aniversários Food.');
  }
});

router.get('/birthday-settings', requireFoodPermission('crm.view'), async (req, res) => {
  try {
    const settings = await prisma.foodBirthdayAutomationSettings.findUnique({
      where: { organizationId: req.foodContext.organizationId },
      include: { coupon: true, segment: true },
    });
    res.json(settings || defaultBirthdaySettings);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a configuração de aniversários.');
  }
});

router.patch('/birthday-settings', requireFoodPermission('crm.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const enabled = req.body?.enabled === true;
    const daysBeforeValue = Number(req.body?.daysBefore ?? 0);
    const validityDaysValue = Number(req.body?.validityDays ?? 7);
    const minimumOrderValue = Number(req.body?.minimumOrder ?? 0);
    if (!Number.isFinite(daysBeforeValue) || !Number.isFinite(validityDaysValue) || !Number.isFinite(minimumOrderValue)) {
      throw domainError('Valores numéricos da configuração são inválidos.');
    }
    const daysBefore = Math.min(30, Math.max(0, Math.round(daysBeforeValue)));
    const sendTime = valueText(req.body?.sendTime, 5) || '09:00';
    const channel = ['WHATSAPP', 'SMS', 'EMAIL'].includes(String(req.body?.channel).toUpperCase()) ? String(req.body.channel).toUpperCase() : 'WHATSAPP';
    const template = valueText(req.body?.template, 1000);
    const benefitType = req.body?.benefitType === 'coupon' ? 'coupon' : 'none';
    const couponId = valueText(req.body?.couponId, 80);
    const segmentId = valueText(req.body?.segmentId, 80);
    const validityDays = Math.min(365, Math.max(1, Math.round(validityDaysValue)));
    const minimumOrder = Math.max(0, minimumOrderValue);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) throw domainError('Horário inválido.');
    if (enabled && !template) throw domainError('A mensagem de aniversário é obrigatória.');
    if (couponId) {
      const coupon = await prisma.foodCoupon.findFirst({ where: { id: couponId, organizationId, active: true } });
      if (!coupon) throw domainError('Cupão de aniversário inválido.');
    }
    if (benefitType === 'coupon' && !couponId) throw domainError('Seleccione um cupão para o benefício.');
    if (segmentId) {
      const segment = await prisma.foodCustomerSegment.findFirst({ where: { id: segmentId, organizationId, active: true } });
      if (!segment) throw domainError('Segmento de aniversário inválido.');
    }
    const settings = await prisma.foodBirthdayAutomationSettings.upsert({
      where: { organizationId },
      update: { enabled, daysBefore, sendTime, channel, template: template || defaultBirthdaySettings.template, benefitType, couponId: benefitType === 'coupon' ? couponId : null, validityDays, minimumOrder, segmentId, updatedByUserId: req.foodContext.personId },
      create: { organizationId, enabled, daysBefore, sendTime, channel, template: template || defaultBirthdaySettings.template, benefitType, couponId: benefitType === 'coupon' ? couponId : null, validityDays, minimumOrder, segmentId, createdByUserId: req.foodContext.personId, updatedByUserId: req.foodContext.personId },
      include: { coupon: true, segment: true },
    });
    await recordFoodAudit(prisma, req, { action: 'marketing.birthday-settings.updated', entityType: 'food_birthday_automation_settings', entityId: settings.id, reason: req.body?.reason, payload: { enabled, daysBefore, channel, benefitType, couponId: settings.couponId, segmentId } });
    res.json(settings);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar a configuração de aniversários.');
  }
});

router.get('/overview', requireFoodPermission('crm.view'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const [customers, consented, segments, coupons, campaigns] = await Promise.all([
      prisma.foodCustomerProfile.count({ where: { organizationId, contact: { status: { not: 'inativo' } } } }),
      prisma.foodCustomerProfile.count({ where: { organizationId, marketingConsent: true, contact: { status: { not: 'inativo' } } } }),
      prisma.foodCustomerSegment.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }),
      prisma.foodCoupon.findMany({ where: { organizationId }, include: { _count: { select: { redemptions: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.foodMarketingCampaign.findMany({ where: { organizationId }, include: { segment: true, coupon: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    res.json({ customers, consented, segments, coupons, campaigns });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o CRM Food.');
  }
});

router.post('/segments', requireFoodPermission('crm.edit'), async (req, res) => {
  try {
    const name = valueText(req.body?.name, 120);
    if (!name) throw domainError('Nome do segmento é obrigatório.');
    const segment = await prisma.foodCustomerSegment.create({
      data: {
        organizationId: req.foodContext.organizationId,
        name,
        description: valueText(req.body?.description),
        filters: req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {},
        createdByUserId: req.foodContext.personId,
      },
    });
    res.status(201).json(segment);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar o segmento.');
  }
});

router.post('/coupons', requireFoodPermission('campaigns.edit'), async (req, res) => {
  try {
    const code = valueText(req.body?.code, 40)?.toUpperCase();
    const name = valueText(req.body?.name, 120);
    const discountType = req.body?.discountType === 'percentage' ? 'percentage' : 'fixed';
    const discountValue = Number(req.body?.discountValue);
    if (!code || !name) throw domainError('Código e nome do cupão são obrigatórios.');
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percentage' && discountValue > 100)) {
      throw domainError('Valor do desconto inválido.');
    }
    const coupon = await prisma.foodCoupon.create({
      data: {
        organizationId: req.foodContext.organizationId,
        code,
        name,
        discountType,
        discountValue,
        minimumOrder: Math.max(0, Number(req.body?.minimumOrder || 0)),
        maximumDiscount: Number.isFinite(Number(req.body?.maximumDiscount)) ? Number(req.body.maximumDiscount) : null,
        startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : null,
        endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
        usageLimit: Number.isInteger(Number(req.body?.usageLimit)) ? Number(req.body.usageLimit) : null,
        perCustomerLimit: Math.max(1, Number(req.body?.perCustomerLimit || 1)),
        createdByUserId: req.foodContext.personId,
      },
    });
    res.status(201).json(coupon);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar o cupão.');
  }
});

router.post('/campaigns', requireFoodPermission('campaigns.edit'), async (req, res) => {
  try {
    const name = valueText(req.body?.name, 160);
    const content = valueText(req.body?.content, 1000);
    if (!name || !content) throw domainError('Nome e conteúdo da campanha são obrigatórios.');
    const segmentId = valueText(req.body?.segmentId, 80);
    const couponId = valueText(req.body?.couponId, 80);
    if (segmentId) {
      const segment = await prisma.foodCustomerSegment.findFirst({ where: { id: segmentId, organizationId: req.foodContext.organizationId, active: true } });
      if (!segment) throw domainError('Segmento inválido.');
    }
    if (couponId) {
      const coupon = await prisma.foodCoupon.findFirst({ where: { id: couponId, organizationId: req.foodContext.organizationId, active: true } });
      if (!coupon) throw domainError('Cupão inválido.');
    }
    const campaign = await prisma.foodMarketingCampaign.create({
      data: {
        organizationId: req.foodContext.organizationId,
        segmentId,
        couponId,
        name,
        channel: req.body?.channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS',
        content,
        status: 'draft',
        scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
        createdByUserId: req.foodContext.personId,
      },
    });
    res.status(201).json(campaign);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar a campanha.');
  }
});

module.exports = router;
