const { copySync, rmSync } = require('fs-extra');
const path = require('path');

/**
 * Copies the tutorial kit build artifacts
 */
rmSync(path.resolve(path.join(__dirname, 'public/tutorials')), {
  recursive: true,
  force: true,
});
copySync(
  path.resolve(path.join(__dirname, '../tutorial/dist')),
  path.resolve(path.join(__dirname, 'public/tutorials')),
  { overwrite: true }
);
