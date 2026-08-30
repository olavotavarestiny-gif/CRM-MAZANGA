'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const stateDir = path.join(projectRoot, '.local-dev');
const pidPath = path.join(stateDir, 'dev.pid');
const logPath = path.join(stateDir, 'dev.log');
const localDatabaseUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://kukugest:kukugest_local@127.0.0.1:5433/kukugest_dev?schema=public&connection_limit=10';

function readPid() {
  try {
    const pid = Number(fs.readFileSync(pidPath, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (_error) {
    return null;
  }
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function removeStalePid() {
  try {
    fs.unlinkSync(pidPath);
  } catch (_error) {
    // O ficheiro pode não existir.
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(750);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function isHttpHealthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    await response.body?.cancel().catch(() => {});
    return response.status < 500;
  } catch (_error) {
    return false;
  }
}

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

async function prepareLocalDatabase() {
  if (!await isPortOpen(5433)) {
    if (!commandExists('docker')) {
      console.error('PostgreSQL local indisponível e Docker Desktop não está instalado ou iniciado.');
      console.error('Instale/inicie Docker Desktop e volte a executar `npm run dev`.');
      return false;
    }
    console.log('A iniciar PostgreSQL local...');
    const compose = spawnSync('docker', ['compose', 'up', '-d', '--wait', 'postgres'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (compose.status !== 0 || !await isPortOpen(5433)) {
      console.error('Não foi possível iniciar o PostgreSQL local. Consulte o estado do Docker Desktop.');
      return false;
    }
  }

  console.log('A aplicar migrations locais...');
  const migration = spawnSync('npm', ['--prefix', 'backend', 'run', 'db:migrate:deploy'], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: localDatabaseUrl, DIRECT_URL: localDatabaseUrl },
    stdio: 'inherit',
  });
  if (migration.status !== 0) {
    console.error('As migrations locais falharam. A aplicação não será iniciada com um schema incompleto.');
    return false;
  }
  return true;
}

async function start() {
  fs.mkdirSync(stateDir, { recursive: true });
  const currentPid = readPid();
  if (isRunning(currentPid)) {
    const [frontendHealthy, backendReady] = await Promise.all([
      isHttpHealthy('http://127.0.0.1:3000/login'),
      isHttpHealthy('http://127.0.0.1:3011/api/ready'),
    ]);
    if (frontendHealthy && backendReady) {
      console.log(`KukuGest local já está ligado (PID ${currentPid}).`);
      console.log('Abra http://localhost:3000/food ou execute `npm run dev:status`.');
      return;
    }
    console.log(`O supervisor ${currentPid} está activo, mas os servidores não respondem. A reconstruir o ambiente...`);
    try { process.kill(currentPid, 'SIGTERM'); } catch (_error) { /* processo terminou entretanto */ }
    for (let attempt = 0; attempt < 20 && isRunning(currentPid); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (isRunning(currentPid)) {
      console.error('O supervisor antigo não terminou. Execute `npm run dev:stop` e tente novamente.');
      process.exitCode = 1;
      return;
    }
  }
  removeStalePid();

  if (!await prepareLocalDatabase()) {
    process.exitCode = 1;
    return;
  }

  const occupiedPorts = [];
  for (const port of [3000, 3011]) {
    if (await isPortOpen(port)) occupiedPorts.push(port);
  }
  if (occupiedPorts.length > 0) {
    console.error(`Já existem processos locais nas portas ${occupiedPorts.join(', ')}.`);
    console.error('No Terminal antigo, pressione Ctrl+C. Depois execute novamente `npm run dev`.');
    process.exitCode = 1;
    return;
  }

  const logFd = fs.openSync(logPath, 'a');
  fs.writeSync(logFd, `\n--- Arranque ${new Date().toISOString()} ---\n`);
  const child = spawn(process.execPath, [path.join(__dirname, 'dev-local.js')], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, DATABASE_URL: localDatabaseUrl, DIRECT_URL: localDatabaseUrl },
    stdio: ['ignore', logFd, logFd],
  });
  fs.writeFileSync(pidPath, `${child.pid}\n`);
  child.unref();
  fs.closeSync(logFd);

  await new Promise((resolve) => setTimeout(resolve, 1_000));
  if (!isRunning(child.pid)) {
    removeStalePid();
    console.error('O ambiente local não conseguiu iniciar. Consulte `.local-dev/dev.log`.');
    process.exitCode = 1;
    return;
  }

  console.log(`KukuGest local iniciado em segundo plano (PID ${child.pid}).`);
  console.log('Aplicação: http://localhost:3000/food');
  console.log('Estado: npm run dev:status');
  console.log('Logs: npm run dev:logs');
  console.log('Parar: npm run dev:stop');
}

async function stop() {
  const pid = readPid();
  if (!isRunning(pid)) {
    removeStalePid();
    console.log('O ambiente local persistente já está parado.');
    return;
  }

  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 20 && isRunning(pid); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (isRunning(pid)) {
    console.error(`O processo ${pid} ainda está a terminar. Consulte os logs antes de tentar novamente.`);
    process.exitCode = 1;
    return;
  }
  removeStalePid();
  console.log('KukuGest local parado.');
}

const command = process.argv[2] || 'start';
if (command === 'start') void start();
else if (command === 'stop') void stop();
else {
  console.error('Uso: node scripts/dev-daemon.js <start|stop>');
  process.exitCode = 1;
}
