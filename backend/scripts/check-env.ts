#!/usr/bin/env tsx
/**
 * Validate environment for sandbox or production.
 * Usage: npm run env:check
 * Exit code 0 = OK, 1 = errors (warnings alone still exit 0).
 */
import fs from 'fs';
import path from 'path';
import { validateAppEnv } from '../src/lib/appConfig';

function loadEnvFile() {
  if (process.env.DATABASE_URL) return;

  const candidates = [
    process.env.APP_ENV_FILE,
    '.env.dev',
    '.env',
  ].filter(Boolean) as string[];

  for (const name of candidates) {
    const envPath = path.isAbsolute(name) ? name : path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return;
  }
}

loadEnvFile();

const result = validateAppEnv();

console.log(`\nDeployment: ${result.deployment}`);
console.log(`Status: ${result.ok ? 'OK' : 'FAILED'}\n`);

if (result.errors.length) {
  console.log('Errors:');
  result.errors.forEach((e) => console.log(`  - ${e}`));
}

if (result.warnings.length) {
  console.log('Warnings:');
  result.warnings.forEach((w) => console.log(`  - ${w}`));
}

if (!result.errors.length && !result.warnings.length) {
  console.log('All required variables look good.');
}

console.log('');
process.exit(result.ok ? 0 : 1);
