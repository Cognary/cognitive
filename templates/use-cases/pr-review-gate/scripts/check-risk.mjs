import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-risk.mjs <envelope.json>');
  process.exit(2);
}

const raw = fs.readFileSync(file, 'utf8');
let env;
try {
  env = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(2);
}

if (!env || typeof env !== 'object') {
  console.error('Invalid envelope (not an object)');
  process.exit(2);
}

if (env.ok !== true) {
  const msg = env?.error?.message ?? 'module returned ok=false';
  console.error('Cognitive run failed:', msg);
  process.exit(2);
}

const risk = env?.meta?.risk;
if (risk !== 'none' && risk !== 'low' && risk !== 'medium' && risk !== 'high') {
  console.error('Invalid meta.risk:', String(risk));
  process.exit(2);
}

console.log(`meta.risk=${risk}`);

// Default policy: block only "high".
if (risk === 'high') {
  console.error('Blocked: meta.risk=high');
  process.exit(1);
}

process.exit(0);

