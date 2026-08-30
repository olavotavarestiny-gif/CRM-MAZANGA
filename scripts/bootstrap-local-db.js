'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'backend', 'prisma', 'schema.prisma');
const schemaSqlPath = path.join(projectRoot, '.local-dev', 'current-schema.sql');
const historySqlPath = path.join(projectRoot, '.local-dev', 'prisma-history.sql');
const databaseUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://kukugest:kukugest_local@127.0.0.1:5433/kukugest_dev?schema=public&connection_limit=10';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: options.stdio || 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    input: options.input,
    encoding: options.encoding,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  return result;
}

fs.mkdirSync(path.dirname(schemaSqlPath), { recursive: true });

console.log('A recriar apenas as bases locais kukugest_dev e kukugest_test...');
run('docker', [
  'compose',
  'exec',
  '-T',
  'postgres',
  'psql',
  '-U',
  'kukugest',
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('kukugest_dev','kukugest_test') and pid <> pg_backend_pid();",
  '-c',
  'drop database if exists kukugest_dev;',
  '-c',
  'drop database if exists kukugest_test;',
  '-c',
  'create database kukugest_dev owner kukugest;',
  '-c',
  'create database kukugest_test owner kukugest;',
]);

console.log('A gerar schema atual a partir do Prisma...');
const diff = run(
  path.join(projectRoot, 'backend', 'node_modules', '.bin', 'prisma'),
  ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'],
  { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }
);
fs.writeFileSync(schemaSqlPath, diff.stdout);

console.log('A aplicar schema atual na base local...');
run('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'kukugest', '-d', 'kukugest_dev', '-v', 'ON_ERROR_STOP=1'], {
  input: diff.stdout,
  encoding: 'utf8',
});

console.log('A registar histórico local das migrations...');
const history = run('node', ['scripts/generate-prisma-history-sql.js'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  encoding: 'utf8',
});
fs.writeFileSync(historySqlPath, history.stdout);
run('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'kukugest', '-d', 'kukugest_dev', '-v', 'ON_ERROR_STOP=1'], {
  input: history.stdout,
  encoding: 'utf8',
});

console.log('Base local reconstruída. Execute `npm run dev`.');
