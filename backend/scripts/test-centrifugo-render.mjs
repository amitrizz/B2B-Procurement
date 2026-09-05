#!/usr/bin/env node
/**
 * Test Render Centrifugo publish (uses CENTRIFUGO_* from .env.dev).
 * Usage: npm run centrifugo:test:render
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RENDER_URL = 'https://centrifugo-latest-31xv.onrender.com';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  for (const name of ['.env.dev', '.env']) {
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

const url = (process.env.CENTRIFUGO_URL || RENDER_URL).replace(/\/$/, '');
const apiKey = process.env.CENTRIFUGO_API_KEY || '';

console.log(`Testing ${url}\n`);

if (!apiKey) {
  console.error('CENTRIFUGO_API_KEY missing in .env.dev');
  process.exit(1);
}

const body = JSON.stringify({
  method: 'publish',
  params: { channel: 'global_updates', data: { type: 'test', message: 'render ping' } },
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
    console.log(`OK (${res.status}): ${text}`);
    console.log('\nRender Centrifugo is ready. Restart backend + frontend dev servers.');
    process.exit(0);
  }
  console.error(`FAIL (${res.status}): ${text || res.statusText}`);
  if (res.status === 401) {
    console.error(`
401 = API keys on Render do NOT match backend/.env.dev

In Render Dashboard → centrifugo-latest-31xv → Environment, add:

  CENTRIFUGO_HTTP_API_KEY=my-super-secret-api-key-2026
  CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY=my-super-secret-hmac-key-2026
  CENTRIFUGO_CLIENT_ALLOWED_ORIGINS=http://127.0.0.1:3000 http://localhost:3000 https://b2bprocurementui.vercel.app
  CENTRIFUGO_CHANNEL_WITHOUT_NAMESPACE_ALLOW_SUBSCRIBE_FOR_CLIENT=true

Then Save → Deploy. Re-run: npm run centrifugo:test:render
`);
  }
  process.exit(1);
} catch (err) {
  console.error('Request failed:', err.message);
  process.exit(1);
}
