import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aboutFilePath = path.resolve(__dirname, '../src/options/components/About.tsx');

try {
  let content = fs.readFileSync(aboutFilePath, 'utf-8');
  
  // Regex to find "const build = <number>;"
  const buildRegex = /const build = (\d+);/;
  const match = content.match(buildRegex);
  
  if (match) {
    const currentBuild = parseInt(match[1], 10);
    const newBuild = currentBuild + 1;
    
    content = content.replace(buildRegex, `const build = ${newBuild};`);
    
    fs.writeFileSync(aboutFilePath, content, 'utf-8');
    console.log(`Updated build number to ${newBuild} in About.tsx`);
  } else {
    console.error('Could not find build number pattern in About.tsx');
    // We don't exit with error here to allow dev server to start even if update fails
  }
} catch (error) {
  console.error('Error updating build number:', error);
}
