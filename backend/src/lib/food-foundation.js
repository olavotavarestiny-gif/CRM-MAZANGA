'use strict';

const DEFAULT_ORDER_TYPES = ['delivery', 'pickup', 'dine_in'];
const DEFAULT_PAYMENT_METHODS = ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER'];

const DEFAULT_FOOD_SETTINGS = {
  id: null,
  userId: null,
  isEnabled: false,
  restaurantName: null,
  logoUrl: null,
  primaryColor: '#0f766e',
  secondaryColor: null,
  restaurantPhone: null,
  restaurantEmail: null,
  restaurantAddress: null,
  currency: 'AOA',
  timezone: 'Africa/Luanda',
  defaultPreparationMinutes: 20,
  kdsGreenMinutes: 15,
  kdsYellowMinutes: 25,
  kdsRedMinutes: 35,
  orderTypes: DEFAULT_ORDER_TYPES,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  kitchenSoundEnabled: true,
  kitchenSoundVolume: 0.7,
  kitchenSoundRepeatSeconds: 20,
  kdsUnacceptedWarningSeconds: 60,
  kdsUnacceptedEscalationSeconds: 120,
  kdsReadyReminderMinutes: 5,
  createdByUserId: null,
  createdAt: null,
  updatedAt: null,
};

function parseJsonList(value, fallback) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [...fallback];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [...fallback];
  } catch {
    return [...fallback];
  }
}

function normalizeStringList(value, fallback) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value.map((item) => String(item || '').trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : [...fallback];
}

function serializeStringList(value, fallback) {
  return JSON.stringify(normalizeStringList(value, fallback) || fallback);
}

function normalizeHexColor(value, fallback = null) {
  if (value === undefined) return undefined;
  if (!value) return fallback;
  const normalized = String(value).trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

function normalizeNullableText(value, max = 200) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function toPositiveInt(value, fallback, { min = 1, max = 600 } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toVolume(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function serializeFoodSettings(settings) {
  if (!settings) return { ...DEFAULT_FOOD_SETTINGS };
  return {
    ...settings,
    orderTypes: parseJsonList(settings.orderTypes, DEFAULT_ORDER_TYPES),
    paymentMethods: parseJsonList(settings.paymentMethods, DEFAULT_PAYMENT_METHODS),
  };
}

function buildFoodSettingsUpdate(input = {}) {
  const data = {};

  if (input.isEnabled !== undefined) data.isEnabled = Boolean(input.isEnabled);
  if (input.restaurantName !== undefined) data.restaurantName = input.restaurantName ? String(input.restaurantName).trim() : null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl ? String(input.logoUrl).trim() : null;
  if (input.primaryColor !== undefined) data.primaryColor = normalizeHexColor(input.primaryColor, DEFAULT_FOOD_SETTINGS.primaryColor);
  if (input.secondaryColor !== undefined) data.secondaryColor = normalizeHexColor(input.secondaryColor, null);
  if (input.restaurantPhone !== undefined) data.restaurantPhone = normalizeNullableText(input.restaurantPhone, 80);
  if (input.restaurantEmail !== undefined) data.restaurantEmail = normalizeNullableText(input.restaurantEmail, 120);
  if (input.restaurantAddress !== undefined) data.restaurantAddress = normalizeNullableText(input.restaurantAddress, 240);
  if (input.currency !== undefined) data.currency = String(input.currency || 'AOA').trim().toUpperCase().slice(0, 8) || 'AOA';
  if (input.timezone !== undefined) data.timezone = String(input.timezone || 'Africa/Luanda').trim() || 'Africa/Luanda';
  if (input.defaultPreparationMinutes !== undefined) {
    data.defaultPreparationMinutes = toPositiveInt(input.defaultPreparationMinutes, DEFAULT_FOOD_SETTINGS.defaultPreparationMinutes);
  }
  if (input.kdsGreenMinutes !== undefined) {
    data.kdsGreenMinutes = toPositiveInt(input.kdsGreenMinutes, DEFAULT_FOOD_SETTINGS.kdsGreenMinutes);
  }
  if (input.kdsYellowMinutes !== undefined) {
    data.kdsYellowMinutes = toPositiveInt(input.kdsYellowMinutes, DEFAULT_FOOD_SETTINGS.kdsYellowMinutes);
  }
  if (input.kdsRedMinutes !== undefined) {
    data.kdsRedMinutes = toPositiveInt(input.kdsRedMinutes, DEFAULT_FOOD_SETTINGS.kdsRedMinutes);
  }
  if (input.orderTypes !== undefined) data.orderTypes = serializeStringList(input.orderTypes, DEFAULT_ORDER_TYPES);
  if (input.paymentMethods !== undefined) data.paymentMethods = serializeStringList(input.paymentMethods, DEFAULT_PAYMENT_METHODS);
  if (input.kitchenSoundEnabled !== undefined) data.kitchenSoundEnabled = Boolean(input.kitchenSoundEnabled);
  if (input.kitchenSoundVolume !== undefined) data.kitchenSoundVolume = toVolume(input.kitchenSoundVolume, DEFAULT_FOOD_SETTINGS.kitchenSoundVolume);
  if (input.kitchenSoundRepeatSeconds !== undefined) data.kitchenSoundRepeatSeconds = toPositiveInt(input.kitchenSoundRepeatSeconds, DEFAULT_FOOD_SETTINGS.kitchenSoundRepeatSeconds, { min: 5, max: 300 });
  if (input.kdsUnacceptedWarningSeconds !== undefined) data.kdsUnacceptedWarningSeconds = toPositiveInt(input.kdsUnacceptedWarningSeconds, DEFAULT_FOOD_SETTINGS.kdsUnacceptedWarningSeconds, { min: 10, max: 600 });
  if (input.kdsUnacceptedEscalationSeconds !== undefined) data.kdsUnacceptedEscalationSeconds = toPositiveInt(input.kdsUnacceptedEscalationSeconds, DEFAULT_FOOD_SETTINGS.kdsUnacceptedEscalationSeconds, { min: 20, max: 1800 });
  if (input.kdsReadyReminderMinutes !== undefined) data.kdsReadyReminderMinutes = toPositiveInt(input.kdsReadyReminderMinutes, DEFAULT_FOOD_SETTINGS.kdsReadyReminderMinutes, { min: 1, max: 120 });

  return data;
}

async function isFoodEnabled(prisma, userId) {
  const settings = await prisma.foodSettings.findUnique({
    where: { userId },
    select: { isEnabled: true },
  });
  return settings?.isEnabled === true;
}

function requireFoodWorkspace(req, res, next) {
  if (req.user?.isDevAuthBypass) return next();
  if (req.user?.planContext?.workspaceMode !== 'food') {
    return res.status(404).json({ error: 'KukuGest Food indisponível neste workspace.' });
  }
  return next();
}

function requireFoodEnabled(prisma) {
  return async (req, res, next) => {
    try {
      const enabled = await isFoodEnabled(prisma, req.user.effectiveUserId);
      if (!enabled) {
        return res.status(403).json({
          error: 'KukuGest Food ainda não está activo nesta empresa.',
          code: 'FOOD_NOT_ENABLED',
        });
      }
      return next();
    } catch (error) {
      console.error('[food] enablement gate error:', error);
      return res.status(500).json({ error: 'Erro ao validar activação do KukuGest Food.' });
    }
  };
}

module.exports = {
  DEFAULT_ORDER_TYPES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_FOOD_SETTINGS,
  parseJsonList,
  serializeFoodSettings,
  buildFoodSettingsUpdate,
  isFoodEnabled,
  requireFoodWorkspace,
  requireFoodEnabled,
  toPositiveInt,
};
