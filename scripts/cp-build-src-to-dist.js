const { copySync } = require('fs-extra');
const { join } = require('node:path');
const { workspaceRoot } = require('@nx/devkit');

const project = process.argv[2];

const src = join(workspaceRoot, `build/packages/${project}/src`);
const dist = join(workspaceRoot, `build/packages/${project}/dist`);

copySync(src, dist);

console.log(`Output: ${dist}`);
