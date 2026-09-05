#!/usr/bin/env node
/**
 * Quick Centrifugo connectivity check.
 * Usage: node scripts/test-centrifugo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  for (const name of [process.env.APP_ENV_FILE, '.env.dev', '.env']) {
    if (!name) continue;
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    break;
  }
}

loadEnv();

const url = (process.env.CENTRIFUGO_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const apiKey = process.env.CENTRIFUGO_API_KEY || '';
const hmac = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY || '';

console.log(`CENTRIFUGO_URL=${url}`);
console.log(`CENTRIFUGO_API_KEY=${apiKey ? '(set)' : '(missing)'}`);
console.log(`CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=${hmac ? '(set)' : '(missing)'}\n`);

if (!apiKey) {
  console.error('Set CENTRIFUGO_API_KEY in .env.dev');
  process.exit(1);
}

const body = JSON.stringify({
  method: 'publish',
  params: { channel: 'global_updates', data: { type: 'test', message: 'ping' } },
});

try {
  const res = await fetch(`${url}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `apikey ${apiKey}`,
    },
    body,
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`OK publish (${res.status}): ${text}`);
    process.exit(0);
  }
  console.error(`FAIL publish (${res.status}): ${text}`);
  if (res.status === 401) {
    console.error('\n401 = API key mismatch. On Render, redeploy using backend/centrifugo/Dockerfile');
    console.error('or set CENTRIFUGO_HTTP_API_KEY to match CENTRIFUGO_API_KEY in backend env.');
  }
  process.exit(1);
} catch (err) {
  console.error('Request failed:', err.message);
  process.exit(1);
}
