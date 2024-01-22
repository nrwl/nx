const { copySync } = require('fs-extra');
const path = require('path');

/**
 * Copies the documentation into the proper Next.js public folder
 */
copySync(
  path.resolve(path.join(__dirname, '../../docs')),
  path.resolve(path.join(__dirname, 'public/documentation')),
  { overwrite: true }
);
