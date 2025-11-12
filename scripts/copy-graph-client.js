const fs = require('fs-extra');

fs.copySync('dist/apps/graph', 'packages/nx/dist/src/core/graph', {
  filter: (src) => !src.includes('assets'),
});
