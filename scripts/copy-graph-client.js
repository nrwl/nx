const fs = require('fs-extra');

fs.copySync('dist/apps/graph', 'packages/nx/dist/core/graph', {
  filter: (src) => !src.includes('assets'),
});
