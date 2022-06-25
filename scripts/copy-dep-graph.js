const fs = require('fs-extra');

fs.copySync('build/apps/dep-graph', 'build/packages/nx/src/core/dep-graph', {
  filter: (src) => !src.includes('assets'),
});
