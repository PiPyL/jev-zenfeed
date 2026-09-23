import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipFileName = `zenfeed-v${version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

const filesToInclude = [
  'manifest.json',
  '_locales',
  'icons',
  'src',
  'README.md',
  'LICENSE'
];

if (fs.existsSync(path.join(rootDir, 'README.vi.md'))) {
  filesToInclude.push('README.vi.md');
}

if (fs.existsSync(path.join(rootDir, 'CONTRIBUTING.md'))) {
  filesToInclude.push('CONTRIBUTING.md');
}

console.log(`📦 Packaging ZenFeed v${version} into ${zipFileName}...`);

// Use system zip command with clean exclusions
const command = `zip -r "${zipFilePath}" ${filesToInclude.join(' ')} -x "*.DS_Store" "*__MACOSX*"`;
execSync(command, { cwd: rootDir, stdio: 'inherit' });

const stats = fs.statSync(zipFilePath);
console.log(`✅ Package created successfully: ${zipFilePath} (${(stats.size / 1024).toFixed(1)} KB)`);
