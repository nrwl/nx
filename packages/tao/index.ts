#!/usr/bin/env node
// this is to support older workspaces
if (process.argv[2] === 'migrate') {
  process.argv[2] = '_migrate';
}

console.warn(
  `@nrwl/tao has been deprecated and will not be published in Nx 17. Please update your global install of nx: https://nx.dev/more-concepts/global-nx`
);

require('nx/bin/nx');
