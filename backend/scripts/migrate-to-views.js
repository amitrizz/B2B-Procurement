const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const frontendDir = path.join(__dirname, '../../frontend');
const appDashboardDir = path.join(frontendDir, 'src/app/dashboard');
const componentsDir = path.join(appDashboardDir, 'components');
const viewsDir = path.join(frontendDir, 'src/views');

// Ensure views directory exists
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Map of components to view folder names
const viewMapping = {
  'MarketplaceTab.tsx': 'marketplace',
  'MyRequirementsTab.tsx': 'rfqs',
  'PurchaseOrdersTab.tsx': 'orders',
  'LocalDeliveryTab.tsx': 'delivery',
  'AdminTab.tsx': 'admin',
  'StandardCatalogTab.tsx': 'standard_catalog',
  'ProfileTab.tsx': 'profile',
  'RequisitionsTab.tsx': 'requisitions',
  'CatalogTab.tsx': 'catalog',
  'CompanyChatTab.tsx': 'chat'
};

// Child components that belong to specific views
const childComponents = {
  'rfqs': ['SamplingPanel.tsx'],
  'orders': ['RepeatPoModal.tsx'],
  'admin': ['AdminUsersTab.tsx'],
  'chat': ['AdminChatQaSection.tsx']
};

console.log('Migrating components to views...');

for (const [componentFile, viewName] of Object.entries(viewMapping)) {
  const componentPath = path.join(componentsDir, componentFile);
  if (!fs.existsSync(componentPath)) continue;

  const viewPath = path.join(viewsDir, viewName);
  if (!fs.existsSync(viewPath)) fs.mkdirSync(viewPath, { recursive: true });

  // Move component to views/viewName/index.tsx
  const targetPath = path.join(viewPath, 'index.tsx');
  let content = fs.readFileSync(componentPath, 'utf8');

  // If this component had a CSS module, move it too
  const cssModulePath = componentPath.replace('.tsx', '.module.css');
  if (fs.existsSync(cssModulePath)) {
    const targetCssPath = path.join(viewPath, 'index.module.scss');
    fs.renameSync(cssModulePath, targetCssPath);
    // Update import in TSX
    content = content.replace(/import styles from '\.\/.*\.module\.css';/, "import styles from './index.module.scss';");
  }

  // Handle relative imports (e.g., if it imports child components)
  // For simplicity, we will just write the file first, then fix imports globally later if needed.
  fs.writeFileSync(targetPath, content);
  fs.unlinkSync(componentPath); // Remove original

  // Move associated child components
  if (childComponents[viewName]) {
    const childDir = path.join(viewPath, 'components');
    if (!fs.existsSync(childDir)) fs.mkdirSync(childDir, { recursive: true });

    for (const child of childComponents[viewName]) {
      const childPath = path.join(componentsDir, child);
      if (fs.existsSync(childPath)) {
        let childContent = fs.readFileSync(childPath, 'utf8');
        fs.writeFileSync(path.join(childDir, child), childContent);
        fs.unlinkSync(childPath);

        // Update import in index.tsx
        let indexContent = fs.readFileSync(targetPath, 'utf8');
        indexContent = indexContent.replace(new RegExp(`import\\s+([A-Za-z0-9_]+)\\s+from\\s+['"]\\.\\/${child.replace('.tsx', '')}['"]`), `import $1 from './components/${child.replace('.tsx', '')}'`);
        fs.writeFileSync(targetPath, indexContent);
      }
    }
  }

  // Update app/dashboard/[viewName]/page.tsx to point to the new view
  const pagePath = path.join(appDashboardDir, viewName, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    let pageContent = fs.readFileSync(pagePath, 'utf8');
    const componentName = componentFile.replace('.tsx', '');
    pageContent = pageContent.replace(new RegExp(`import ${componentName} from '\\.\\./components/${componentName}';`), `import ${componentName} from '@/views/${viewName}';`);
    fs.writeFileSync(pagePath, pageContent);
  }
}

console.log('Views migration complete.');
