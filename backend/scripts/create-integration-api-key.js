const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

const prisma = require('../src/lib/prisma');
const { DEFAULT_SCOPES, generateApiKey, getKeyPrefix, hashApiKey } = require('../src/lib/integration-api-key');

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const email = argument('email')?.trim().toLowerCase();
  const userId = Number(argument('user-id')) || null;
  const name = argument('name')?.trim() || 'Integração externa';
  if (!email && !userId) throw new Error('Use --email <email> ou --user-id <id>.');

  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })
    : await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) throw new Error('Conta não encontrada.');

  const rawKey = generateApiKey();
  await prisma.integrationApiKey.create({
    data: { userId: user.id, name, keyPrefix: getKeyPrefix(rawKey), keyHash: hashApiKey(rawKey), scopes: JSON.stringify(DEFAULT_SCOPES) },
  });
  console.log(JSON.stringify({ account: user.name, userId: user.id, apiKey: rawKey }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
