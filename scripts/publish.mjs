#!/usr/bin/env node
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('🔨 Building packages...\n');

execSync('npx nx build @fluffjs/fluff --skip-nx-cache', { cwd: root, stdio: 'inherit' });
execSync('npx nx build @fluffjs/cli --skip-nx-cache', { cwd: root, stdio: 'inherit' });

console.log('\n📦 Publishing packages...\n');

execSync('npm publish', { cwd: path.join(root, 'packages/fluff/dist'), stdio: 'inherit' });
execSync('npm publish', { cwd: path.join(root, 'packages/cli/dist'), stdio: 'inherit' });

console.log('\n✅ Published successfully!');
