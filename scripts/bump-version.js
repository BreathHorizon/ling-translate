import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const manifestJsonPath = path.resolve(__dirname, '../src/manifest.json');

try {
  // Read files
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf-8'));

  // Parse version
  const currentVersion = packageJson.version;
  const versionParts = currentVersion.split('.').map(Number);
  
  // Increment patch version (build number)
  versionParts[2] += 1;
  const newVersion = versionParts.join('.');

  console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

  // Update objects
  packageJson.version = newVersion;
  manifestJson.version = newVersion;

  // Write files
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');

  console.log('Version updated successfully.');
} catch (error) {
  console.error('Error bumping version:', error);
  process.exit(1);
}
