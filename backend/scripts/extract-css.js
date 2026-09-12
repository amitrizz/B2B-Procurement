const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '../../frontend/src/views/rfqs/index.tsx');
const scssPath = path.join(__dirname, '../../frontend/src/views/rfqs/rfqs.module.scss');

let tsxContent = fs.readFileSync(tsxPath, 'utf8');
let scssContent = fs.readFileSync(scssPath, 'utf8');

// We want to replace className="text-sm border..." with className={styles.someName}
// And append `.someName { @apply text-sm border...; }` to the SCSS file.

let classCounter = 1;

// Replace double quote classNames
tsxContent = tsxContent.replace(/className="([^"]+)"/g, (match, classes) => {
  if (classes.trim() === '') return match;
  
  // Try to generate a somewhat meaningful name based on the first few classes
  let baseName = classes.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
  if (!baseName || baseName.length < 2) baseName = 'style';
  
  const classNameStr = `${baseName}_${classCounter++}`;
  
  scssContent += `\n.${classNameStr} {\n  @apply ${classes};\n}\n`;
  
  return `className={styles.${classNameStr}}`;
});

// Replace simple template literals without interpolation: className={`some classes`}
tsxContent = tsxContent.replace(/className=\{`([^`$]+)`\}/g, (match, classes) => {
  if (classes.trim() === '') return match;
  
  let baseName = classes.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
  if (!baseName || baseName.length < 2) baseName = 'style';
  
  const classNameStr = `${baseName}_${classCounter++}`;
  
  scssContent += `\n.${classNameStr} {\n  @apply ${classes};\n}\n`;
  
  return `className={styles.${classNameStr}}`;
});

fs.writeFileSync(tsxPath, tsxContent);
fs.writeFileSync(scssPath, scssContent);

console.log('Extracted ' + (classCounter - 1) + ' inline classes.');
