const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../frontend/src/app/page.tsx');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\\`/g, '`');
fs.writeFileSync(file, content);
console.log('Fixed backticks.');
