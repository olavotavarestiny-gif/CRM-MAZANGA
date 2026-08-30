'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'backend', 'prisma', 'migrations');

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

console.log('BEGIN;');
for (const name of fs.readdirSync(migrationsDir).sort()) {
  const dir = path.join(migrationsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const migrationFile = path.join(dir, 'migration.sql');
  const contents = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile) : Buffer.from('');
  const checksum = crypto.createHash('sha256').update(contents).digest('hex');
  const id = crypto.randomUUID();
  console.log(
    'INSERT INTO "_prisma_migrations" ' +
      '("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count") ' +
      `VALUES (${sqlString(id)},${sqlString(checksum)},now(),${sqlString(name)},NULL,NULL,now(),1);`
  );
}
console.log('COMMIT;');
