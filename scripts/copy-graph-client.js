const fs = require('fs-extra');

fs.copySync('dist/apps/graph', 'dist/packages/nx/src/core/graph', {
  filter: (src) => !src.includes('assets'),
});
