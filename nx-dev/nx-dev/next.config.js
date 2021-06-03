const { join } = require('path');
// nx-ignore-next-line
const withNx = require('@nrwl/next/plugins/with-nx');

module.exports = withNx({
  env: {
    WORKSPACE_ROOT: join(__dirname, '../..'),
  },
});
