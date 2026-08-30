'use strict';

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const daemonPidPath = path.join(projectRoot, '.local-dev', 'dev.pid');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'backend', prefix: 'backend', color: '\x1b[36m', healthUrl: 'http://127.0.0.1:3011/health', env: { PORT: '3011' } },
  { name: 'frontend', prefix: 'frontend', color: '\x1b[35m', healthUrl: 'http://127.0.0.1:3000/login', env: { PORT: '3000' } },
];
const resetColor = '\x1b[0m';
const children = new Map();
const restartTimers = new Map();
const startedAt = new Map();
const healthFailures = new Map();
const HEALTH_INTERVAL_MS = 10_000;
const HEALTH_GRACE_MS = 25_000;
const HEALTH_TIMEOUT_MS = 5_000;
const MAX_HEALTH_FAILURES = 3;
let stopping = false;
let healthTimer = null;

function writeLine(service, line, target = process.stdout) {
  target.write(`${service.color}[${service.name}]${resetColor} ${line}\n`);
}

function pipeLines(stream, service, target) {
  readline.createInterface({ input: stream }).on('line', (line) => writeLine(service, line, target));
}

function startService(service) {
  if (stopping) return;

  writeLine(service, `A iniciar ${service.prefix}...`);
  const child = spawn(npmCommand, ['--prefix', service.prefix, 'run', 'dev'], {
    cwd: projectRoot,
    env: { ...process.env, ...service.env },
    detached: process.platform !== 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.set(service.name, child);
  startedAt.set(service.name, Date.now());
  healthFailures.set(service.name, 0);
  pipeLines(child.stdout, service, process.stdout);
  pipeLines(child.stderr, service, process.stderr);

  child.on('error', (error) => {
    writeLine(service, `Falha ao iniciar: ${error.message}`, process.stderr);
  });

  child.on('exit', (code, signal) => {
    children.delete(service.name);
    startedAt.delete(service.name);
    healthFailures.delete(service.name);
    if (stopping) return;

    writeLine(
      service,
      `Terminou (${signal ? `sinal ${signal}` : `código ${code ?? 'desconhecido'}`}). Nova tentativa em 2 segundos.`,
      process.stderr
    );
    const timer = setTimeout(() => {
      restartTimers.delete(service.name);
      startService(service);
    }, 2_000);
    restartTimers.set(service.name, timer);
  });
}

async function checkServiceHealth(service) {
  const child = children.get(service.name);
  if (!child || !child.pid || Date.now() - (startedAt.get(service.name) || 0) < HEALTH_GRACE_MS) return;

  try {
    const response = await fetch(service.healthUrl, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    healthFailures.set(service.name, 0);
  } catch (error) {
    const failures = (healthFailures.get(service.name) || 0) + 1;
    healthFailures.set(service.name, failures);
    writeLine(service, `Health check falhou (${failures}/${MAX_HEALTH_FAILURES}): ${error.message}`, process.stderr);

    if (failures >= MAX_HEALTH_FAILURES) {
      writeLine(service, 'Servidor deixou de responder. A reiniciar...', process.stderr);
      stopChild(child);
    }
  }
}

function stopChild(child, signal = 'SIGTERM') {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (healthTimer) clearInterval(healthTimer);
  process.stdout.write(`\nA terminar ambiente local (${signal})...\n`);

  for (const timer of restartTimers.values()) clearTimeout(timer);
  restartTimers.clear();
  for (const child of children.values()) stopChild(child);

  const forceTimer = setTimeout(() => {
    for (const child of children.values()) stopChild(child, 'SIGKILL');
    process.exit(0);
  }, 3_000);
  forceTimer.unref();

  if (children.size === 0) process.exit(0);
  for (const child of children.values()) {
    child.once('exit', () => {
      if ([...children.values()].every((runningChild) => runningChild.exitCode !== null || runningChild.signalCode !== null)) {
        process.exit(0);
      }
    });
  }
}

function removeOwnDaemonPid() {
  try {
    const recordedPid = Number(require('fs').readFileSync(daemonPidPath, 'utf8').trim());
    if (recordedPid === process.pid) require('fs').unlinkSync(daemonPidPath);
  } catch (_error) {
    // Execuções em primeiro plano não têm necessariamente um PID file.
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', removeOwnDaemonPid);

process.stdout.write('KukuGest local: frontend + backend com reinício automático.\n');
for (const service of services) startService(service);
healthTimer = setInterval(() => {
  for (const service of services) void checkServiceHealth(service);
}, HEALTH_INTERVAL_MS);
