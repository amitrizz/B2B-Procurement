const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../../frontend/src/views');
const viewFolders = fs.readdirSync(viewsDir, { withFileTypes: true }).filter(d => d.isDirectory());

for (const folder of viewFolders) {
  const folderName = folder.name;
  const oldCssPath = path.join(viewsDir, folderName, 'index.module.scss');
  // I will use [folderName].module.scss. E.g. rfqs.module.scss
  const newCssName = `${folderName}.module.scss`;
  const newCssPath = path.join(viewsDir, folderName, newCssName);

  if (fs.existsSync(oldCssPath)) {
    fs.renameSync(oldCssPath, newCssPath);
    console.log(`Renamed ${oldCssPath} to ${newCssPath}`);
  }

  // Update import in index.tsx
  const indexTsxPath = path.join(viewsDir, folderName, 'index.tsx');
  if (fs.existsSync(indexTsxPath)) {
    let content = fs.readFileSync(indexTsxPath, 'utf8');
    // It might be importing index.module.scss
    if (content.includes("import styles from './index.module.scss'")) {
      content = content.replace("import styles from './index.module.scss'", `import styles from './${newCssName}'`);
      fs.writeFileSync(indexTsxPath, content);
      console.log(`Updated import in ${indexTsxPath}`);
    } else if (fs.existsSync(newCssPath) && !content.includes(`import styles from './${newCssName}'`)) {
      // If we are creating empty css files for all views? The prompt says "each view have own css file"
    }
  }
}

// The user said "each view have own css file". Let's create an empty one for those that don't have it.
for (const folder of viewFolders) {
  const folderName = folder.name;
  const cssName = `${folderName}.module.scss`;
  const cssPath = path.join(viewsDir, folderName, cssName);
  
  if (!fs.existsSync(cssPath)) {
    fs.writeFileSync(cssPath, `@reference "../../app/globals.css";\n\n/* Styles for ${folderName} view */\n`);
    console.log(`Created ${cssPath}`);
  }
  
  const indexTsxPath = path.join(viewsDir, folderName, 'index.tsx');
  if (fs.existsSync(indexTsxPath)) {
    let content = fs.readFileSync(indexTsxPath, 'utf8');
    if (!content.includes(`import styles from './${cssName}'`)) {
      // Inject the import at the top
      content = content.replace(/import {?[^;]+;/, (match) => `${match}\nimport styles from './${cssName}';`);
      fs.writeFileSync(indexTsxPath, content);
      console.log(`Added import to ${indexTsxPath}`);
    }
  }
}

console.log('CSS renaming and creation complete.');
