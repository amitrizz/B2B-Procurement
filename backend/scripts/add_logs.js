const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;

walkDir(API_DIR, (filePath) => {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    const relativePath = filePath.split('src\\\\app\\\\api')[1] || filePath.split('src\\app\\api')[1] || filePath.split('src/app/api')[1];
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Replace: return NextResponse.json(
    // With: return console.log(`[API Response] /api${relativePath}`), NextResponse.json(
    // We only replace if it hasn't been replaced already.
    const searchString = 'return NextResponse.json(';
    const replacementString = `return console.log(\`[API Response] /api\${normalizedPath.replace('/route.ts', '')} - Sending response\`), NextResponse.json(`;

    if (content.includes(searchString) && !content.includes(replacementString)) {
      content = content.split(searchString).join(replacementString);
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedCount++;
      console.log(`Modified: ${normalizedPath}`);
    }
  }
});

console.log(`\nSuccessfully injected logs into ${modifiedCount} endpoints.`);
