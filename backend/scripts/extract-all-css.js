const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../../frontend/src/views');
const viewFolders = fs.readdirSync(viewsDir, { withFileTypes: true }).filter(d => d.isDirectory());

for (const folder of viewFolders) {
  const folderName = folder.name;
  const tsxPath = path.join(viewsDir, folderName, 'index.tsx');
  const scssPath = path.join(viewsDir, folderName, `${folderName}.module.scss`);
  
  if (!fs.existsSync(tsxPath) || !fs.existsSync(scssPath)) continue;

  let tsxContent = fs.readFileSync(tsxPath, 'utf8');
  let scssContent = fs.readFileSync(scssPath, 'utf8');

  let classCounter = 1;
  let changed = false;

  tsxContent = tsxContent.replace(/className="([^"]+)"/g, (match, classes) => {
    if (classes.trim() === '') return match;
    let baseName = classes.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    if (!baseName || baseName.length < 2) baseName = 'style';
    
    // Make sure we generate a completely unique class name by prefixing with folderName
    const classNameStr = `${baseName}_${classCounter++}`;
    scssContent += `\n.${classNameStr} {\n  @apply ${classes};\n}\n`;
    changed = true;
    return `className={styles.${classNameStr}}`;
  });

  tsxContent = tsxContent.replace(/className=\{`([^`$]+)`\}/g, (match, classes) => {
    if (classes.trim() === '') return match;
    let baseName = classes.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    if (!baseName || baseName.length < 2) baseName = 'style';
    
    const classNameStr = `${baseName}_${classCounter++}`;
    scssContent += `\n.${classNameStr} {\n  @apply ${classes};\n}\n`;
    changed = true;
    return `className={styles.${classNameStr}}`;
  });

  if (changed) {
    fs.writeFileSync(tsxPath, tsxContent);
    fs.writeFileSync(scssPath, scssContent);
    console.log(`Extracted inline classes for ${folderName}.`);
  }
}

console.log('Done extracting for all views.');
