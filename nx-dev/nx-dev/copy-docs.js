const { copySync, rmSync } = require('fs-extra');
const path = require('path');

/**
 * Copies the documentation into the proper Next.js public folder
 */
rmSync(path.resolve(path.join(__dirname, 'public/documentation')), {
  recursive: true,
  force: true,
});
copySync(
  path.resolve(path.join(__dirname, '../../docs')),
  path.resolve(path.join(__dirname, 'public/documentation')),
  { overwrite: true }
);
