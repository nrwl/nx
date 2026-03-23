#!/usr/bin/env node

// Wrapper script that works in both compiled (dist/) and source (TS) contexts.
// See nx.js for details.

const path = require('path');
const fs = require('fs');

const distEntry = path.join(__dirname, '..', 'dist', 'bin', 'nx-cloud.js');

if (fs.existsSync(distEntry)) {
  require(distEntry);
} else {
  require('@swc-node/register/register');
  require('./nx-cloud.ts');
}
