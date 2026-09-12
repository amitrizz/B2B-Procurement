const fs = require('fs');
const path = require('path');

const myReqPath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
let content = fs.readFileSync(myReqPath, 'utf8');

const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];/;
const match = content.match(importRegex);

if (match) {
    let imports = match[1];
    if (!imports.includes('Clock')) {
        const newImports = imports + ', Clock';
        content = content.replace(importRegex, "import { " + newImports + " } from 'lucide-react';");
        fs.writeFileSync(myReqPath, content);
        console.log('Added Clock import to MyRequirementsTab');
    } else {
        console.log('Clock already imported');
    }
} else {
    // If not found, add a new line
    content = "import { Clock } from 'lucide-react';\n" + content;
    fs.writeFileSync(myReqPath, content);
    console.log('Added Clock import to MyRequirementsTab (new line)');
}
