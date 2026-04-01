const prisma = require('../src/lib/prisma');
const { resolveContactNif } = require('../src/lib/contact-nif');
const { validateNIF } = require('../src/lib/fiscal/nif-validator');

async function main() {
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [{ nif: null }, { nif: '' }],
    },
    select: { id: true, nif: true, customFields: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const contact of contacts) {
    const resolvedNif = resolveContactNif(contact);
    if (!resolvedNif || !validateNIF(resolvedNif).valid) {
      skipped += 1;
      continue;
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: { nif: resolvedNif },
    });
    updated += 1;
  }

  console.log(`NIF backfill concluído. Actualizados: ${updated}. Ignorados: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error('Erro no backfill de NIF dos contactos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
