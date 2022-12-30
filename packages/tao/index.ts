#!/usr/bin/env node
// this is to support older workspaces
if (process.argv[2] === 'migrate') {
  process.argv[2] = '_migrate';
}

require('nx/bin/nx');
