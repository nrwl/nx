#!/usr/bin/env node

// Wrapper script that works in both compiled (dist/) and source (TS) contexts.
// When installed from npm, dist/bin/nx.js exists and is used directly.
// When workspace-linked in the nx repo, dist/ may not exist, so we fall back
// to registering swc-node and loading the TypeScript source.

const path = require('path');
const fs = require('fs');

const distEntry = path.join(__dirname, '..', 'dist', 'bin', 'nx.js');

if (fs.existsSync(distEntry)) {
  require(distEntry);
} else {
  require('@swc-node/register/register');
  require('./nx.ts');
}
