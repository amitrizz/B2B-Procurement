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
    
    // Get the actual relative path to inject
    const relativePath = filePath.split('src\\\\app\\\\api')[1] || filePath.split('src\\app\\api')[1] || filePath.split('src/app/api')[1];
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const actualPathString = normalizedPath.replace('/route.ts', '');

    // The literal broken string that was accidentally written
    const searchString = "${normalizedPath.replace('/route.ts', '')}";

    if (content.includes(searchString)) {
      content = content.split(searchString).join(actualPathString);
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedCount++;
      console.log(`Fixed: ${normalizedPath}`);
    }
  }
});

console.log(`\nSuccessfully fixed syntax in ${modifiedCount} endpoints.`);
