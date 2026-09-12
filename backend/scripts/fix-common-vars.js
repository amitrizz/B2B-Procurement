const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../../frontend/src/views');
const viewFolders = fs.readdirSync(viewsDir, { withFileTypes: true }).filter(d => d.isDirectory());

viewFolders.forEach(folder => {
  const view = folder.name;
  const scssPath = path.join(viewsDir, view, `${view}.module.scss`);
  
  if (!fs.existsSync(scssPath)) return;

  let content = fs.readFileSync(scssPath, 'utf8');
  let original = content;

  // Replace buyer and supplier prefixes for common variables
  content = content.replace(/var\(--(buyer|supplier)-text-/g, 'var(--text-');
  content = content.replace(/var\(--(buyer|supplier)-font-/g, 'var(--font-');
  content = content.replace(/var\(--(buyer|supplier)-padding-/g, 'var(--padding-');
  content = content.replace(/var\(--(buyer|supplier)-shadow-/g, 'var(--shadow-');
  
  // also handle --buyer-bg or --supplier-bg just in case they were generated
  content = content.replace(/var\(--(buyer|supplier)-bg\)/g, 'var(--bg-color)');

  if (content !== original) {
    fs.writeFileSync(scssPath, content);
    console.log(`Updated common variables in ${view}`);
  }
});
