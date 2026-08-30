#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { homedir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const bundledPython = path.join(
  homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3.12',
);
const python = process.env.FOOD_GUIDE_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');
const generator = path.join(__dirname, 'generate-food-guide-pdf.py');
const result = spawnSync(python, [generator], { stdio: 'inherit' });

if (result.error) {
  console.error(`Não foi possível executar ${python}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error('Instale reportlab, pdfplumber e pypdf ou defina FOOD_GUIDE_PYTHON.');
  process.exit(result.status || 1);
}
