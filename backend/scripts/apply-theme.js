const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../../frontend/src/views');
const viewFolders = fs.readdirSync(viewsDir, { withFileTypes: true }).filter(d => d.isDirectory());

const classMappings = {
  // Colors (Buyer)
  'text-\\[#001D4A\\]': 'color: var(--buyer-text-title);',
  'text-blue-900': 'color: var(--buyer-text-title);',
  'text-blue-500': 'color: var(--buyer-primary);',
  'text-blue-600': 'color: var(--buyer-primary);',
  'bg-blue-50': 'background-color: var(--buyer-secondary);',
  'bg-blue-100': 'background-color: var(--buyer-secondary);',
  'bg-blue-500': 'background-color: var(--buyer-primary);',
  'bg-blue-600': 'background-color: var(--buyer-primary);',
  'border-blue-200': 'border-color: var(--buyer-secondary);',
  
  // Colors (Supplier)
  'text-emerald-900': 'color: var(--supplier-text-title);',
  'text-emerald-500': 'color: var(--supplier-primary);',
  'text-emerald-600': 'color: var(--supplier-primary);',
  'bg-emerald-50': 'background-color: var(--supplier-secondary);',
  'bg-emerald-100': 'background-color: var(--supplier-secondary);',
  'bg-emerald-500': 'background-color: var(--supplier-primary);',
  'bg-emerald-600': 'background-color: var(--supplier-primary);',
  'border-emerald-200': 'border-color: var(--supplier-secondary);',
  
  // Neutral text
  'text-slate-500': 'color: var(--buyer-text-subtitle);',
  'text-gray-500': 'color: var(--buyer-text-subtitle);',
  'text-slate-600': 'color: var(--buyer-text-normal);',
  'text-slate-700': 'color: var(--buyer-text-normal);',
  'text-gray-700': 'color: var(--buyer-text-normal);',

  // Font Sizes
  'text-\\[22px\\]': 'font-size: var(--buyer-font-header);',
  'text-\\[18px\\]': 'font-size: var(--buyer-font-title);',
  'text-lg': 'font-size: var(--buyer-font-title);',
  'text-\\[14px\\]': 'font-size: var(--buyer-font-normal);',
  'text-sm': 'font-size: var(--buyer-font-normal);',
  'text-\\[13px\\]': 'font-size: var(--buyer-font-subtitle);',
  'text-xs': 'font-size: var(--buyer-font-subtitle);',
  'text-\\[20px\\]': 'font-size: var(--buyer-font-modal-title);',

  // Paddings
  'p-6': 'padding: var(--buyer-padding-card);',
  'p-5': 'padding: var(--buyer-padding-card);',
  'p-8': 'padding: var(--buyer-padding-modal);',
};

viewFolders.forEach(folder => {
  const view = folder.name;
  const scssPath = path.join(viewsDir, view, `${view}.module.scss`);
  
  if (!fs.existsSync(scssPath)) return;

  let scssContent = fs.readFileSync(scssPath, 'utf8');
  let changed = false;

  // For each class block, we will parse the @apply string
  const blockRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
  let newScssContent = scssContent.replace(blockRegex, (match, className, innerContent) => {
    let newInner = innerContent;
    let cssProperties = [];
    
    // Extract @apply line
    const applyRegex = /@apply\s+([^;]+);/g;
    newInner = newInner.replace(applyRegex, (applyMatch, classesStr) => {
      let classes = classesStr.split(/\s+/).filter(Boolean);
      let remainingClasses = [];
      
      classes.forEach(cls => {
        let matched = false;
        // Escape special chars just for matching keys since keys have escapes
        for (const [key, prop] of Object.entries(classMappings)) {
          // the key might have \\[, we need to match it against actual class which has \[
          // Actually, in the apply string it's `text-[#001D4A]`.
          const unescapedKey = key.replace(/\\/g, ''); 
          if (cls === unescapedKey) {
            cssProperties.push(prop);
            matched = true;
            changed = true;
            break;
          }
        }
        if (!matched) {
          remainingClasses.push(cls);
        }
      });
      
      if (remainingClasses.length > 0) {
        return `@apply ${remainingClasses.join(' ')};`;
      } else {
        return '';
      }
    });

    if (cssProperties.length > 0) {
      newInner = newInner.trimEnd() + '\n  ' + cssProperties.join('\n  ') + '\n';
    }

    return `.${className} {${newInner}}`;
  });

  // Clean up empty apply
  newScssContent = newScssContent.replace(/@apply\s*;\n?/g, '');

  if (changed) {
    fs.writeFileSync(scssPath, newScssContent);
    console.log(`Applied theme variables to ${view}`);
  }
});
