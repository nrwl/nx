import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(packageDir, '../..');
const srcPath = path.join(packageDir, 'package.json');
const distPath = path.join(packageDir, 'dist', 'package.json');
const rootPkgPath = path.join(workspaceRoot, 'package.json');

const pkg = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

pkg.version = rootPkg.version;

delete pkg.private;

delete pkg.nx;

pkg.publishConfig = { access: 'public' };

pkg.main = './index.js';
pkg.module = './index.js';
pkg.types = './index.d.ts';
pkg.exports = {
    './package.json': './package.json',
    '.': {
        types: './index.d.ts',
        import: './index.js',
        default: './index.js'
    }
};
pkg.files = ['**/*.js', '**/*.d.ts', '!*.tsbuildinfo'];

fs.writeFileSync(distPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('✓ Copied package.json to dist/ (without private field)');
