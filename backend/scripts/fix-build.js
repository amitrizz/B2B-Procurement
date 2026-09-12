const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '../../frontend');

// 1. Delete [[...tab]]_backup
const backupDir = path.join(frontendDir, 'src/app/dashboard/[[...tab]]_backup');
if (fs.existsSync(backupDir)) {
  fs.rmSync(backupDir, { recursive: true, force: true });
  console.log('Deleted backup dir');
}

// 2. Fix admin/index.tsx importing AdminChatQaSection
const adminIndex = path.join(frontendDir, 'src/views/admin/index.tsx');
if (fs.existsSync(adminIndex)) {
  let content = fs.readFileSync(adminIndex, 'utf8');
  content = content.replace("import AdminChatQaSection from './components/AdminChatQaSection';", "import AdminChatQaSection from '../chat/components/AdminChatQaSection';");
  fs.writeFileSync(adminIndex, content);
  console.log('Fixed admin/index.tsx');
}
