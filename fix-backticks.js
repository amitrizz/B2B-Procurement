const fs = require('fs');
let file = 'frontend/src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\\`/g, '`');
fs.writeFileSync(file, content);
console.log('Fixed backticks.');
