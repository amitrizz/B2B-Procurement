const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '../../frontend/src/views/orders/index.tsx');
const scssPath = path.join(__dirname, '../../frontend/src/views/orders/orders.module.scss');

let tsxContent = fs.readFileSync(tsxPath, 'utf8');
let scssContent = fs.readFileSync(scssPath, 'utf8');

// Replace group in scss
scssContent = scssContent.replace(/@apply (.*?)group(.*?);/g, '@apply $1$2;');
scssContent = scssContent.replace(/  @apply relative  shrink-0;/g, '  @apply relative shrink-0;');

// Replace in tsx
tsxContent = tsxContent.replace(/className=\{styles\['orders--relative-group-shrink-0'\]\}/g, 'className={`group ${styles[\'orders--relative-group-shrink-0\']}`}');
tsxContent = tsxContent.replace(/className=\{styles\['orders--relative-group-shrink-0-1'\]\}/g, 'className={`group ${styles[\'orders--relative-group-shrink-0-1\']}`}');
tsxContent = tsxContent.replace(/className=\{styles\['orders--relative-group-shrink-0-2'\]\}/g, 'className={`group ${styles[\'orders--relative-group-shrink-0-2\']}`}');
tsxContent = tsxContent.replace(/className=\{styles\['orders--relative-group-shrink-0-3'\]\}/g, 'className={`group ${styles[\'orders--relative-group-shrink-0-3\']}`}');
tsxContent = tsxContent.replace(/className=\{styles\['orders--relative-group-shrink-0-4'\]\}/g, 'className={`group ${styles[\'orders--relative-group-shrink-0-4\']}`}');

fs.writeFileSync(tsxPath, tsxContent);
fs.writeFileSync(scssPath, scssContent);

console.log('Fixed group');
