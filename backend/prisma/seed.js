const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create automation
  const automation = await prisma.automation.create({
    data: {
      trigger: 'new_contact',
      action: 'send_whatsapp_template',
      templateName: 'welcome_message',
      active: true,
    },
  });
  console.log('Created automation:', automation);

  // Create sample contacts
  const contact1 = await prisma.contact.create({
    data: {
      name: 'João Silva',
      email: 'joao@example.com',
      phone: '351912345678',
      company: 'Tech Corp',
      service: 'Web Development',
      stage: 'LEAD',
    },
  });
  console.log('Created contact 1:', contact1);

  const contact2 = await prisma.contact.create({
    data: {
      name: 'Maria Santos',
      email: 'maria@example.com',
      phone: '351912345679',
      company: 'Marketing Agency',
      service: 'Social Media',
      stage: 'CLIENT',
    },
  });
  console.log('Created contact 2:', contact2);

  // Create sample messages
  const msg1 = await prisma.message.create({
    data: {
      contactId: contact1.id,
      direction: 'inbound',
      text: 'Olá, gostaria de saber mais sobre vossos serviços',
    },
  });
  console.log('Created message 1:', msg1);

  const msg2 = await prisma.message.create({
    data: {
      contactId: contact1.id,
      direction: 'outbound',
      text: 'Obrigado pelo interesse! Faremos contacto em breve.',
    },
  });
  console.log('Created message 2:', msg2);

  console.log('Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
