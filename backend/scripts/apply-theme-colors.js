const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/views/orders/orders.module.scss',
  'frontend/src/views/chat/chat.module.scss',
  'frontend/src/views/profile/profile.module.scss',
];

const classMap = {
  // text
  'text-white': 'color: var(--text-title);',
  'text-slate-200': 'color: var(--text-normal);',
  'text-slate-300': 'color: var(--text-normal);',
  'text-slate-400': 'color: var(--text-subtitle);',
  'text-slate-500': 'color: var(--text-subtitle);',

  // background
  'bg-slate-900': 'background-color: var(--card-bg-light);',
  'bg-slate-950': 'background-color: var(--card-bg-light);',
  'bg-slate-950/60': 'background-color: var(--card-bg-light);',
  'bg-slate-950/40': 'background-color: var(--card-bg-light);',
  'bg-slate-800': 'background-color: var(--bg-color);', // slightly different bg

  // borders
  'border-white/10': 'border-color: var(--card-border-light);',
  'border-white/5': 'border-color: var(--card-border-light);',
  
  // Specific accent replacements (if needed)
};

files.forEach(file => {
  const filePath = path.resolve(__dirname, '../../', file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - does not exist.`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Also replace some hardcoded CSS properties
  content = content.replace(/background:\s*rgba\(31,\s*41,\s*55,\s*0\.4\);/g, 'background: var(--card-bg-light);');
  content = content.replace(/border:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.05\);/g, 'border: 1px solid var(--card-border-light);');
  
  // Parse blocks
  const blocks = content.split('}');
  
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i];
    if (!block.trim()) continue;
    
    // Process @apply
    const applyRegex = /@apply([^;]*?);/g;
    block = block.replace(applyRegex, (match, applyStr) => {
      let newApply = applyStr;
      let newRules = [];
      
      for (const [cls, rule] of Object.entries(classMap)) {
        const clsRegex = new RegExp(`\\b${cls.replace(/\//g, '\\/')}\\b`, 'g');
        if (clsRegex.test(newApply)) {
          newApply = newApply.replace(clsRegex, '');
          newRules.push(rule);
        }
      }
      
      // clean up extra spaces
      newApply = newApply.replace(/\s+/g, ' ').trim();
      
      let res = '';
      if (newApply.length > 0) {
        res += `@apply ${newApply};\n`;
      }
      if (newRules.length > 0) {
        res += `  ${newRules.join('\n  ')}`;
      }
      return res;
    });
    
    blocks[i] = block;
  }
  
  fs.writeFileSync(filePath, blocks.join('}'));
  console.log(`Updated ${file}`);
});
