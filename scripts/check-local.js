'use strict';

const checks = [
  { name: 'Frontend', urls: ['http://localhost:3000/login', 'http://127.0.0.1:3000/login'] },
  { name: 'Backend', urls: ['http://localhost:3011/health', 'http://127.0.0.1:3011/health'] },
  { name: 'Base de dados', urls: ['http://localhost:3011/api/ready', 'http://127.0.0.1:3011/api/ready'] },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  return { response, elapsed: Date.now() - startedAt };
}

async function check({ name, urls }) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const url of urls) {
      try {
        const { response, elapsed } = await request(url);
        let detail = '';
        if (name === 'Base de dados') {
          const payload = await response.json().catch(() => null);
          detail = payload?.database ? `, database=${payload.database}` : '';
        } else {
          await response.body?.cancel().catch(() => {});
        }
        const ok = response.status < 500;
        console.log(`${ok ? 'OK' : 'ERRO'}  ${name}: HTTP ${response.status}, ${elapsed}ms${detail}`);
        return ok;
      } catch (error) {
        lastError = error;
      }
    }
    if (attempt < 3) await sleep(1_000);
  }
  console.log(`ERRO  ${name}: ${lastError?.message || 'sem resposta'}`);
  return false;
}

async function main() {
  const results = [];
  for (const item of checks) results.push(await check(item));
  if (results.every(Boolean)) {
    console.log('\nAmbiente local operacional: http://localhost:3000/food');
    return;
  }
  console.log('\nExecute `npm run dev`. O supervisor continuará em segundo plano depois do arranque.');
  process.exitCode = 1;
}

main();
