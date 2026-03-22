// Script para migrar dados existentes e assignar ao admin (id: 3)
const prisma = require('../src/lib/prisma');

async function migrate() {
  try {
    console.log('🔄 Iniciando migration de dados...\n');

    const adminId = 3;

    // Migrate Contacts
    const contactsUpdated = await prisma.contact.updateMany({
      where: { userId: null },
      data: { userId: adminId }
    });
    console.log(`✅ Contactos: ${contactsUpdated.count} actualizados`);

    // Migrate Tasks
    const tasksUpdated = await prisma.task.updateMany({
      where: { userId: null },
      data: { userId: adminId }
    });
    console.log(`✅ Tarefas: ${tasksUpdated.count} actualizadas`);

    // Migrate Transactions
    const transactionsUpdated = await prisma.transaction.updateMany({
      where: { userId: null },
      data: { userId: adminId }
    });
    console.log(`✅ Transações: ${transactionsUpdated.count} actualizadas`);

    // Migrate Automations
    const automationsUpdated = await prisma.automation.updateMany({
      where: { userId: null },
      data: { userId: adminId }
    });
    console.log(`✅ Automações: ${automationsUpdated.count} actualizadas`);

    // Migrate Forms
    const formsUpdated = await prisma.form.updateMany({
      where: { userId: null },
      data: { userId: adminId }
    });
    console.log(`✅ Formulários: ${formsUpdated.count} actualizados`);

    console.log('\n✨ Migration completa! Todos os dados foram assignados ao admin.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migration:', error.message);
    process.exit(1);
  }
}

migrate();
