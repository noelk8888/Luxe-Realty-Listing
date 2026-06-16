const fs = require('fs');
const content = fs.readFileSync('src/components/UserManagementModal.tsx', 'utf8');

const viewerMatch = content.match(/V1: \{([\s\S]*?)\},/);
if (viewerMatch) {
  console.log("V1 Defaults:", viewerMatch[1].replace(/\n/g, ' '));
}

const featuresMatch = content.match(/const FEATURES.*?=\s*\[([\s\S]*?)\];/);
if (featuresMatch) {
  console.log("Features:", featuresMatch[1].split('\n').filter(l => l.includes('{')).map(l => l.trim()).join('\n'));
}
