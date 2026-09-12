const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../../frontend/src/views');
const viewFolders = fs.readdirSync(viewsDir, { withFileTypes: true }).filter(d => d.isDirectory());

const customClasses = ['glass-card', 'custom-scrollbar', 'fade-in', 'glass-panel', 'slide-in-from-bottom-4', 'animate-in', 'zoom-in-95'];

viewFolders.forEach(folder => {
  const view = folder.name;
  const tsxPath = path.join(viewsDir, view, 'index.tsx');
  const scssPath = path.join(viewsDir, view, `${view}.module.scss`);
  
  if (!fs.existsSync(tsxPath) || !fs.existsSync(scssPath)) return;

  let tsxContent = fs.readFileSync(tsxPath, 'utf8');
  let scssContent = fs.readFileSync(scssPath, 'utf8');
  let changed = false;

  customClasses.forEach(cls => {
    // Find classes in SCSS that apply this custom class
    const regex = new RegExp(`\\.([a-zA-Z0-9_-]+)\\s*\\{[^}]*@apply[^;]*?\\b${cls}\\b.*?;`, 'g');
    let match;
    while ((match = regex.exec(scssContent)) !== null) {
      const className = match[1];
      
      // Remove it from SCSS
      const applyRegex = new RegExp(`(@apply[^;]*?)\\b${cls}\\b\\s*`, 'g');
      scssContent = scssContent.replace(applyRegex, '$1');
      
      // Add it to TSX
      const tsxRegex = new RegExp(`className=\\{styles\\['${className}'\\]\\}`, 'g');
      if (tsxContent.match(tsxRegex)) {
        tsxContent = tsxContent.replace(tsxRegex, `className={\`${cls} \${styles['${className}']}\`}`);
        changed = true;
      }
      
      // Also handle if it's already in a template literal: className={`group ${styles['...']}`}
      const tsxTemplateRegex = new RegExp(`className=\\{\\\`([^\`]*)\\$\\{styles\\['${className}'\\]\\}(.*)\\\`\\}`, 'g');
      if (tsxContent.match(tsxTemplateRegex)) {
        tsxContent = tsxContent.replace(tsxTemplateRegex, `className={\`${cls} $1\${styles['${className}']}$2\`}`);
        changed = true;
      }
    }
  });

  // Clean up empty @apply left behind
  scssContent = scssContent.replace(/@apply\s*;/g, '');

  if (changed) {
    fs.writeFileSync(tsxPath, tsxContent);
    fs.writeFileSync(scssPath, scssContent);
    console.log(`Fixed custom classes in ${view}`);
  }
});
