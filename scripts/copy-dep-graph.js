const fs = require('fs-extra');

fs.copySync(
  'build/apps/dep-graph',
  'build/packages/workspace/src/core/dep-graph'
);
