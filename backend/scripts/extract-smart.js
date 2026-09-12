const fs = require('fs');
const path = require('path');

const views = process.argv.slice(2);
if (views.length === 0) {
  console.log('Please provide view names');
  process.exit(1);
}

const viewsDir = path.join(__dirname, '../../frontend/src/views');

views.forEach(view => {
  const tsxPath = path.join(viewsDir, view, 'index.tsx');
  const scssPath = path.join(viewsDir, view, `${view}.module.scss`);
  
  if (!fs.existsSync(tsxPath) || !fs.existsSync(scssPath)) {
    console.log(`Skipping ${view} - files not found`);
    return;
  }

  let tsxContent = fs.readFileSync(tsxPath, 'utf8');
  let scssContent = fs.readFileSync(scssPath, 'utf8');
  let changed = false;

  const usedNames = new Set();

  function generateName(classStr) {
    const parts = classStr.trim().split(/\s+/);
    // Take up to first 3 parts, remove non-alphanumeric except hyphens
    let name = parts.slice(0, 3).map(p => p.replace(/[^a-zA-Z0-9-]/g, '')).join('-');
    name = name.replace(/--+/g, '-').replace(/^-|-$/g, '');
    
    if (!name || name.length < 2) name = 'style';
    
    let bemName = `${view}--${name}`;
    
    let counter = 1;
    let finalName = bemName;
    while (usedNames.has(finalName)) {
      finalName = `${bemName}-${counter++}`;
    }
    usedNames.add(finalName);
    return finalName;
  }

  // Replace double quote classNames
  tsxContent = tsxContent.replace(/className="([^"]+)"/g, (match, classes) => {
    if (classes.trim() === '') return match;
    const hasGroup = classes.split(/\s+/).includes('group');
    const cleanClasses = classes.split(/\s+/).filter(c => c !== 'group').join(' ');
    
    if (cleanClasses === '') return hasGroup ? 'className="group"' : match;
    
    const finalName = generateName(cleanClasses);
    scssContent += `\n.${finalName} {\n  @apply ${cleanClasses};\n}\n`;
    changed = true;
    return hasGroup ? `className={\`group \${styles['${finalName}']}\`}` : `className={styles['${finalName}']}`;
  });

  // Replace template literals without variables
  tsxContent = tsxContent.replace(/className=\{`([^`$]+)`\}/g, (match, classes) => {
    if (classes.trim() === '') return match;
    const hasGroup = classes.split(/\s+/).includes('group');
    const cleanClasses = classes.split(/\s+/).filter(c => c !== 'group').join(' ');
    
    if (cleanClasses === '') return hasGroup ? 'className="group"' : match;
    
    const finalName = generateName(cleanClasses);
    scssContent += `\n.${finalName} {\n  @apply ${cleanClasses};\n}\n`;
    changed = true;
    return hasGroup ? `className={\`group \${styles['${finalName}']}\`}` : `className={styles['${finalName}']}`;
  });

  if (changed) {
    fs.writeFileSync(tsxPath, tsxContent);
    fs.writeFileSync(scssPath, scssContent);
    console.log(`Extracted smart classes for ${view}`);
  }
});
