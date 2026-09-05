import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const envName = process.argv[2];
const cmdArgs = process.argv.slice(3);

if (!envName || !['dev', 'prod'].includes(envName)) {
  console.error('Usage: node scripts/run-env.mjs <dev|prod> <command...>');
  process.exit(1);
}

if (!cmdArgs.length) {
  console.error('No command provided');
  process.exit(1);
}

const envFile = path.join(root, `.env.${envName}`);
if (!fs.existsSync(envFile)) {
  console.error(`Missing ${envFile}`);
  console.error(`Copy .env.${envName}.example to .env.${envName} and fill in values.`);
  process.exit(1);
}

function parseEnv(content) {
  const env = {};
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
    env[key] = val;
  }
  return env;
}

const parsed = parseEnv(fs.readFileSync(envFile, 'utf8'));

console.log(`[env] Using ${path.basename(envFile)} (${envName})\n`);

const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: {
    ...process.env,
    ...parsed,
    APP_ENV_FILE: `.env.${envName}`,
  },
});

child.on('exit', (code) => process.exit(code ?? 1));
