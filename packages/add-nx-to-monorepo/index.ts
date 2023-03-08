#!/usr/bin/env node

import { execSync } from 'child_process';

const args = process.argv.slice(2).join(' ');
execSync(`npx --yes nx@latest init ${args}`, {
  stdio: [0, 1, 2],
});
