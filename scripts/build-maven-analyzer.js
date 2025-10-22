// @ts-check

const { execSync } = require('node:child_process');

if (process.env.SKIP_ANALYZER_BUILD !== 'true') {
  execSync('nx install nx-maven-plugin', { stdio: 'inherit' });
}
