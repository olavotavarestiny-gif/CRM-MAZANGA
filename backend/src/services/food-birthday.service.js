const { domainError } = require('../lib/food-domain');

function utcDay(value = new Date()) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function birthdayInYear(birthDate, year) {
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getUTCMonth() !== month) return new Date(Date.UTC(year, 1, 28));
  return candidate;
}

function nextBirthday(birthDateValue, nowValue = new Date()) {
  const birthDate = new Date(birthDateValue);
  if (Number.isNaN(birthDate.getTime())) throw domainError('Data de nascimento inválida.');
  const today = utcDay(nowValue);
  let occurrence = birthdayInYear(birthDate, today.getUTCFullYear());
  if (occurrence < today) occurrence = birthdayInYear(birthDate, today.getUTCFullYear() + 1);
  return {
    date: occurrence,
    daysUntil: Math.round((occurrence.getTime() - today.getTime()) / 86_400_000),
    ageTurning: occurrence.getUTCFullYear() - birthDate.getUTCFullYear(),
  };
}

async function listFoodBirthdays(prisma, organizationId, daysValue = 30, now = new Date()) {
  const days = Math.min(366, Math.max(0, Number.isFinite(Number(daysValue)) ? Number(daysValue) : 30));
  const contacts = await prisma.contact.findMany({
    where: {
      userId: organizationId,
      status: { not: 'inativo' },
      birthDate: { not: null },
      foodProfiles: { some: { organizationId } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      foodProfiles: {
        where: { organizationId },
        select: { marketingConsent: true, preferences: true, totalOrders: true, totalSpent: true },
      },
    },
  });
  return contacts.flatMap((contact) => {
    const upcoming = nextBirthday(contact.birthDate, now);
    if (upcoming.daysUntil > days) return [];
    const profile = contact.foodProfiles[0];
    const preferences = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
    const preferredChannel = ['WHATSAPP', 'SMS', 'EMAIL', 'NONE'].includes(String(preferences.preferredChannel).toUpperCase())
      ? String(preferences.preferredChannel).toUpperCase()
      : 'WHATSAPP';
    const hasDestination = preferredChannel === 'EMAIL' ? Boolean(contact.email) : preferredChannel === 'NONE' ? false : Boolean(contact.phone);
    return [{
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      birthDate: contact.birthDate,
      nextBirthday: upcoming.date,
      daysUntil: upcoming.daysUntil,
      ageTurning: upcoming.ageTurning,
      preferredChannel,
      marketingConsent: profile?.marketingConsent === true,
      eligible: profile?.marketingConsent === true && hasDestination,
      totalOrders: profile?.totalOrders || 0,
      totalSpent: profile?.totalSpent || 0,
    }];
  }).sort((left, right) => left.daysUntil - right.daysUntil || left.name.localeCompare(right.name));
}

module.exports = { utcDay, birthdayInYear, nextBirthday, listFoodBirthdays };
