const fs = require('fs-extra');

fs.copySync('build/apps/graph', 'build/packages/nx/src/core/graph', {
  filter: (src) => !src.includes('assets'),
});
