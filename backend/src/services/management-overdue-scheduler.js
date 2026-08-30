const prisma = require('../lib/prisma');

async function markManagementOverdueTasks() {
  const rows = await prisma.$queryRawUnsafe('SELECT mark_management_overdue_tasks() AS updated');
  return Number(rows[0]?.updated || 0);
}

module.exports = { markManagementOverdueTasks };
