import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const pairs = [
  ['.env.dev.example', '.env.dev'],
  ['.env.prod.example', '.env.prod'],
];

for (const [example, target] of pairs) {
  const examplePath = path.join(root, example);
  const targetPath = path.join(root, target);
  if (fs.existsSync(targetPath)) {
    console.log(`skip ${target} (already exists)`);
    continue;
  }
  if (!fs.existsSync(examplePath)) {
    console.warn(`missing ${example}`);
    continue;
  }
  fs.copyFileSync(examplePath, targetPath);
  console.log(`created ${target} from ${example}`);
}

console.log('\nEdit .env.dev / .env.prod then run: npm run dev  or  npm run start:prod');
